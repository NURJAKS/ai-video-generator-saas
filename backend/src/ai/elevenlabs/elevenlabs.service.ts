import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FfmpegService } from '../../media/ffmpeg.service';

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly apiKey: string;
  private readonly voiceId: string;

  /** ElevenLabs has a per-request character limit */
  private readonly MAX_CHUNK_CHARS = 4500;

  constructor(
    private readonly config: ConfigService,
    private readonly ffmpegService: FfmpegService,
  ) {
    this.apiKey = this.config.get<string>('ELEVENLABS_API_KEY')!;
    this.voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID', 'pNInz6obpgDQGcFmaJgB')!;
  }

  /**
   * Generates premium audio using ElevenLabs v3.
   * Long texts are chunked at sentence boundaries, generated separately,
   * then concatenated via FFmpeg to avoid codec mismatches.
   */
  async generateAudio(text: string, voiceId?: string): Promise<Buffer> {
    const voice = voiceId || this.voiceId;
    const chunks = this.chunkText(text, this.MAX_CHUNK_CHARS);

    this.logger.log(
      `Generating ElevenLabs audio: ${text.length} chars → ${chunks.length} chunk(s)`,
    );

    const audioBuffers: Buffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      this.logger.debug(`Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: chunks[i],
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `ElevenLabs API error (${response.status}) on chunk ${i + 1}: ${errorBody}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
    }

    // Single chunk → return directly, no concatenation needed
    if (audioBuffers.length === 1) {
      return audioBuffers[0];
    }

    // Multiple chunks → concatenate via FFmpeg for codec consistency
    return this.ffmpegService.concatenateAudioBuffers(audioBuffers);
  }

  /**
   * Splits text at sentence boundaries to stay under the character limit.
   * Ensures no chunk exceeds maxLen characters.
   */
  private chunkText(text: string, maxLen: number): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if ((current + sentence).length > maxLen) {
        if (current) chunks.push(current.trim());
        // If a single sentence exceeds maxLen, force-split by words
        if (sentence.length > maxLen) {
          const words = sentence.split(/\s+/);
          let partial = '';
          for (const word of words) {
            if ((partial + ' ' + word).length > maxLen) {
              if (partial) chunks.push(partial.trim());
              partial = word;
            } else {
              partial += ' ' + word;
            }
          }
          current = partial;
        } else {
          current = sentence;
        }
      } else {
        current += sentence;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}
