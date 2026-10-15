import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { VideoGeneration, GenerationStatus } from '../entities/video-generation.entity';
import { CreditsService } from '../../credits/credits.service';
import { ProgressGateway } from '../../websocket/progress.gateway';
import { OpenAiService } from '../../ai/openai/openai.service';
import { ElevenLabsService } from '../../ai/elevenlabs/elevenlabs.service';
import { OpenAiTtsService } from '../../ai/openai/tts.service';
import { FalAiService } from '../../ai/falai/falai.service';
import { FfmpegService } from '../../media/ffmpeg.service';
import { VIDEO_QUEUE } from '../generation.module';
import { VoiceType } from '../entities/video-generation.entity';

interface VideoJobData {
  generationId: string;
  userId: string;
}

@Processor('video-generation')
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    @InjectRepository(VideoGeneration)
    private readonly genRepo: Repository<VideoGeneration>,
    private readonly creditsService: CreditsService,
    private readonly progressGateway: ProgressGateway,
    private readonly openAiService: OpenAiService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly openAiTtsService: OpenAiTtsService,
    private readonly falAiService: FalAiService,
    private readonly ffmpegService: FfmpegService,
  ) {
    super();
  }

  async process(job: Job<VideoJobData>): Promise<void> {
    const { generationId, userId } = job.data;
    const jobId = job.id!;

    this.logger.log(`Processing generation ${generationId} (job ${jobId})`);

    // Load the generation record
    const generation = await this.genRepo.findOneOrFail({
      where: { id: generationId },
    });

    try {
      // Mark as processing
      await this.updateGeneration(generationId, {
        status: GenerationStatus.PROCESSING,
        startedAt: new Date(),
      });

      // ────────────────────────────────────────────────────
      // Stage 1: Text Analysis (0% → 15%)
      // ────────────────────────────────────────────────────
      await this.emitProgress(jobId, generationId, 5, 'Analyzing text...');

      const scenes = await this.openAiService.analyzeScript(generation.scriptText);

      await this.updateGeneration(generationId, {
        pipelineState: { textAnalysis: true, sceneCount: scenes.length },
      });
      await this.emitProgress(jobId, generationId, 15, `Text analyzed — ${scenes.length} scenes`);

      // ────────────────────────────────────────────────────
      // Stage 2: Audio Generation (15% → 40%)
      // ────────────────────────────────────────────────────
      await this.emitProgress(jobId, generationId, 18, 'Generating audio...');

      const audioBuffers: Buffer[] = [];
      
      for (let i = 0; i < scenes.length; i++) {
        const text = scenes[i].text;
        let buffer: Buffer;

        if (generation.voiceType === VoiceType.PREMIUM) {
          try {
            buffer = await this.elevenLabsService.generateAudio(text);
          } catch (elError: any) {
            if (elError.message?.includes('401') || elError.message?.includes('402')) {
              this.logger.warn(`ElevenLabs unavailable (${elError.message}), falling back to OpenAI TTS for scene ${i}`);
              buffer = await this.openAiTtsService.generateAudio(text);
            } else {
              throw elError;
            }
          }
        } else {
          buffer = await this.openAiTtsService.generateAudio(text);
        }
        
        audioBuffers.push(buffer);
        
        const percent = 18 + Math.round(((i + 1) / scenes.length) * 22);
        await this.emitProgress(jobId, generationId, percent, `Generating audio ${i + 1}/${scenes.length}`);
      }

      await this.updateGeneration(generationId, {
        pipelineState: { textAnalysis: true, audioGenerated: true },
      });
      await this.emitProgress(jobId, generationId, 40, 'Audio generated');

      // ────────────────────────────────────────────────────
      // Stage 3: Image Generation (40% → 75%)
      // ────────────────────────────────────────────────────
      await this.emitProgress(jobId, generationId, 42, 'Creating images...');

      const imageBuffers: Buffer[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const prompt = `${scenes[i].imagePrompt}, ${generation.cinematicStyle} style`;
        const image = await this.falAiService.generateImage(
          prompt,
          generation.videoFormat,
        );
        imageBuffers.push(image);

        const percent = 42 + Math.round(((i + 1) / scenes.length) * 33);
        await this.emitProgress(
          jobId,
          generationId,
          percent,
          `Creating images ${i + 1}/${scenes.length}`,
        );
      }

      await this.updateGeneration(generationId, {
        pipelineState: { textAnalysis: true, audioGenerated: true, imagesGenerated: true },
      });

      // ────────────────────────────────────────────────────
      // Stage 4: Video Assembly via FFmpeg (75% → 95%)
      // ────────────────────────────────────────────────────
      await this.emitProgress(jobId, generationId, 78, 'Rendering video...');

      const outputPath = await this.ffmpegService.assembleVideo({
        audioBuffers,
        imageBuffers,
        scenes,
        videoFormat: generation.videoFormat,
        transitionFrequency: generation.transitionFrequency,
        generationId,
      });

      await this.emitProgress(jobId, generationId, 95, 'Finalizing...');

      // ────────────────────────────────────────────────────
      // Stage 5: Finalization (95% → 100%)
      // ────────────────────────────────────────────────────
      await this.updateGeneration(generationId, {
        status: GenerationStatus.COMPLETED,
        progress: 100,
        progressStatus: 'Complete',
        outputUrl: outputPath,
        completedAt: new Date(),
        pipelineState: {
          textAnalysis: true,
          audioGenerated: true,
          imagesGenerated: true,
          videoAssembled: true,
        },
      });

      this.progressGateway.emitProgress(jobId, {
        percent: 100,
        status: 'Complete',
        outputUrl: outputPath,
      });

      this.logger.log(`Generation ${generationId} completed. Output: ${outputPath}`);

    } catch (error: any) {
      this.logger.error(
        `Generation ${generationId} failed: ${error.message}`,
        error.stack,
      );

      // Mark as failed
      await this.updateGeneration(generationId, {
        status: GenerationStatus.FAILED,
        errorMessage: error.message,
        completedAt: new Date(),
      });

      // Compensatory refund
      try {
        await this.creditsService.refundCredits(
          userId,
          generation.creditsCost,
          generationId,
          `Pipeline failure: ${error.message}`,
        );
        this.logger.log(
          `Refunded ${generation.creditsCost} credits to user ${userId} for failed generation ${generationId}`,
        );
      } catch (refundError: any) {
        this.logger.error(`CRITICAL: Refund failed for generation ${generationId}`, refundError.stack);
      }

      // Notify client of failure
      this.progressGateway.emitProgress(jobId, {
        percent: -1,
        status: 'Failed',
        error: error.message,
      });

      throw error; // Let BullMQ handle retries
    }
  }

  // ── Helpers ─────────────────────────────────────────────

  private async updateGeneration(
    id: string,
    data: Partial<VideoGeneration>,
  ): Promise<void> {
    await this.genRepo.update(id, data);
  }

  private async emitProgress(
    jobId: string,
    generationId: string,
    percent: number,
    status: string,
  ): Promise<void> {
    // Persist progress to DB (for polling fallback)
    await this.genRepo.update(generationId, {
      progress: percent,
      progressStatus: status,
    });

    // Push to WebSocket
    this.progressGateway.emitProgress(jobId, { percent, status });
  }
}
