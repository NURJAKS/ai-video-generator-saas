import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Scene } from '../ai/openai/openai.service';
import { VideoFormat } from '../generation/entities/video-generation.entity';

const execFileAsync = promisify(execFile);

interface AssembleVideoParams {
  audioBuffers: Buffer[];
  imageBuffers: Buffer[];
  scenes: Scene[];
  videoFormat: VideoFormat;
  transitionFrequency: number;
  generationId: string;
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR', './uploads')!;
  }

  /**
   * Assembles a final MP4 video from audio + images using FFmpeg.
   * Applies Ken Burns effect (subtle zoom/pan) and crossfade transitions.
   *
   * @returns The relative path to the output MP4 file.
   */
  async assembleVideo(params: AssembleVideoParams): Promise<string> {
    const {
      audioBuffers,
      imageBuffers,
      scenes,
      videoFormat,
      transitionFrequency,
      generationId,
    } = params;

    const workDir = path.join(this.uploadDir, 'temp', generationId);
    const outputDir = path.join(this.uploadDir, 'videos');
    await fs.mkdir(workDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    try {
      // Write audio chunks, measure exact duration, and prepare concat file
      let concatText = '';
      for (let i = 0; i < audioBuffers.length; i++) {
        const audioName = `audio_${i}.mp3`;
        const audioPath = path.join(workDir, audioName);
        await fs.writeFile(audioPath, audioBuffers[i]);
        concatText += `file '${audioName}'\n`;

        try {
          const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audioPath,
          ]);
          const duration = parseFloat(stdout.trim());
          if (!isNaN(duration) && duration > 0) {
            scenes[i].durationSec = duration;
          }
        } catch (err) {
          this.logger.error(`ffprobe failed on ${audioName}: ${err}`);
        }
      }
      await fs.writeFile(path.join(workDir, 'concat.txt'), concatText);

      // Write images to temp files
      const imageFiles: string[] = [];
      for (let i = 0; i < imageBuffers.length; i++) {
        const imgName = `image_${i.toString().padStart(3, '0')}.png`;
        await fs.writeFile(path.join(workDir, imgName), imageBuffers[i]);
        imageFiles.push(imgName);
      }

      // Determine unique speakers and assign colors
      const speakers = new Set(scenes.map(s => s.speaker || 'Narrator'));
      const speakerColors: Record<string, string> = {};
      // Green, Yellow, Cyan, Magenta, Orange
      const colors = ['#00FF00', '#FFFF00', '#00FFFF', '#FF00FF', '#FF8000'];
      
      let colorIndex = 0;
      for (const speaker of speakers) {
        if (speakers.size === 1) {
          speakerColors[speaker] = '#FFFFFF'; // White for single speaker
        } else {
          speakerColors[speaker] = colors[colorIndex % colors.length];
          colorIndex++;
        }
      }

      // Create SRT file
      let srtContent = '';
      let cumulativeTime = 0;
      for (let i = 0; i < scenes.length; i++) {
        const d = scenes[i].durationSec || transitionFrequency;
        const startTime = this.formatSrtTime(cumulativeTime);
        const endTime = this.formatSrtTime(cumulativeTime + d);
        
        srtContent += `${i + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        let subText = (scenes[i].text || '').replace(/\n/g, ' ').trim();
        
        const speaker = scenes[i].speaker || 'Narrator';
        const color = speakerColors[speaker] || '#FFFFFF';
        
        // Apply color using SRT font tag
        subText = `<font color="${color}">${subText}</font>`;
        
        srtContent += `${subText}\n\n`;

        cumulativeTime += d;
      }
      await fs.writeFile(path.join(workDir, 'subtitles.srt'), srtContent);

      // Resolution based on format
      const resolution = videoFormat === VideoFormat.LANDSCAPE
        ? { w: 1920, h: 1080 }
        : { w: 1080, h: 1920 };

      // Build FFmpeg complex filter
      const filterParts: string[] = [];
      const fadeDur = 0.5;
      
      for (let i = 0; i < imageFiles.length; i++) {
        const d = scenes[i]?.durationSec || transitionFrequency;
        const isLast = i === imageFiles.length - 1;
        const vidDur = isLast ? d : d + fadeDur;
        const frames = Math.ceil(vidDur * 30);
        
        // Fast Ken Burns: scale to native res, zoompan at native res, 25fps (no pre-loop!)
        filterParts.push(
          `[${i}:v]scale=${resolution.w}:${resolution.h}:force_original_aspect_ratio=decrease,pad=${resolution.w}:${resolution.h}:(ow-iw)/2:(oh-ih)/2,` +
          `zoompan=z='min(zoom+0.0015,1.3)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${resolution.w}x${resolution.h}:fps=25,` +
          `format=yuv420p,setpts=PTS-STARTPTS[v${i}]`
        );
      }

      let lastOut = '[v0]';
      let currentOffset = 0;

      for (let i = 1; i < imageFiles.length; i++) {
        const prevDuration = scenes[i-1]?.durationSec || transitionFrequency;
        currentOffset += prevDuration - fadeDur;
        
        const nextOut = `[v0${i}]`;
        filterParts.push(`${lastOut}[v${i}]xfade=transition=fade:duration=${fadeDur}:offset=${currentOffset}${nextOut}`);
        lastOut = nextOut;
      }

      // Add subtitles (Premium style: small text, thick outline, bottom aligned)
      // BorderStyle=1 (Outline), Outline=4 (Thick black border), Alignment=2 (Bottom center)
      // Note: MarginV is relative to an internal 288p scale for SRT files in libass. MarginV=20 puts it at the bottom.
      filterParts.push(`${lastOut}subtitles=subtitles.srt:force_style='FontName=Arial,Bold=1,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=20'[outv]`);

      const outputPath = path.resolve(outputDir, `${generationId}.mp4`);

      // Build FFmpeg command args
      const args: string[] = [];
      for (const imgName of imageFiles) {
        args.push('-i', imgName);
      }
      args.push('-f', 'concat', '-safe', '0', '-i', 'concat.txt');

      // Background music check
      const bgMusicPath = path.join(process.cwd(), 'assets', 'music', 'bg.mp3');
      const hasBgMusic = await fs.access(bgMusicPath).then(() => true).catch(() => false);

      if (hasBgMusic) {
        args.push('-stream_loop', '-1', '-i', bgMusicPath);
        const ttsIndex = imageFiles.length;
        const bgIndex = imageFiles.length + 1;
        filterParts.push(`[${ttsIndex}:a]volume=1.0[tts];[${bgIndex}:a]volume=0.03[bg];[tts][bg]amix=inputs=2:duration=first[outa]`);
      }

      const filterComplex = filterParts.join(';\n');

      args.push(
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-map', hasBgMusic ? '[outa]' : `${imageFiles.length}:a`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-y',
        outputPath,
      );

      this.logger.log(`Running FFmpeg assembly for generation ${generationId}...`);

      await execFileAsync('ffmpeg', args, {
        cwd: workDir,
        timeout: 30 * 60 * 1000, 
        maxBuffer: 50 * 1024 * 1024,
      });

      this.logger.log(`FFmpeg completed. Output: ${outputPath}`);

      return `/uploads/videos/${generationId}.mp4`;

    } finally {
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn(`Failed to clean up temp dir: ${workDir}`);
      }
    }
  }

  private formatSrtTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Concatenates multiple audio buffers using FFmpeg.
   * Used by ElevenLabs service for chunked audio assembly.
   */
  async concatenateAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
    const tempDir = path.join(this.uploadDir, 'temp', `concat_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Write each buffer to a temp file
      const filePaths: string[] = [];
      for (let i = 0; i < buffers.length; i++) {
        const filePath = path.join(tempDir, `chunk_${i}.mp3`);
        await fs.writeFile(filePath, buffers[i]);
        filePaths.push(filePath);
      }

      // Write FFmpeg concat list
      const listPath = path.join(tempDir, 'concat_list.txt');
      const listContent = filePaths.map((f) => `file '${f}'`).join('\n');
      await fs.writeFile(listPath, listContent);

      const outputPath = path.join(tempDir, 'output.mp3');

      await execFileAsync('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        '-y',
        outputPath,
      ]);

      return fs.readFile(outputPath);

    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn(`Failed to clean up concat temp dir: ${tempDir}`);
      }
    }
  }
}
