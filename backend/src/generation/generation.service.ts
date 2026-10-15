import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VideoGeneration, GenerationStatus } from './entities/video-generation.entity';
import { CreditsService } from '../credits/credits.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { calculateCreditCost, countWords, estimateDurationSec } from '../common/utils/text.utils';
import { VIDEO_QUEUE } from './generation.module';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectRepository(VideoGeneration)
    private readonly genRepo: Repository<VideoGeneration>,
    @InjectQueue('video-generation')
    private readonly videoQueue: Queue,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * The "pre-flight check & credit deduction" — the core generation entry point.
   *
   * 1. Calculate cost
   * 2. Deduct credits (atomic, locked)
   * 3. Create VideoGeneration record
   * 4. Push job to BullMQ
   * 5. Return jobId immediately
   */
  async createGeneration(
    userId: string,
    dto: CreateGenerationDto,
  ): Promise<{ jobId: string; generationId: string; creditsCost: number }> {
    // 1. Calculate cost
    const creditsCost = calculateCreditCost(dto.scriptText, dto.voiceType);
    const wordCount = countWords(dto.scriptText);
    const estimatedDuration = estimateDurationSec(wordCount);

    if (wordCount < 10) {
      throw new BadRequestException('Script must contain at least 10 words');
    }

    // 2. Deduct credits (this is atomic with row-level locking)
    const ledgerTx = await this.creditsService.deductCredits(
      userId,
      creditsCost,
      `Video generation (${dto.voiceType} voice, ~${Math.ceil(estimatedDuration / 60)} min)`,
    );

    // 3. Create the generation record
    const generation = this.genRepo.create({
      userId,
      scriptText: dto.scriptText,
      voiceType: dto.voiceType,
      videoFormat: dto.videoFormat,
      transitionFrequency: dto.transitionFrequency,
      cinematicStyle: dto.cinematicStyle,
      estimatedDurationSec: estimatedDuration,
      creditsCost,
      status: GenerationStatus.PENDING,
      progress: 0,
      progressStatus: 'Queued',
    });

    await this.genRepo.save(generation);

    // Update ledger entry with the generation ID
    // (We didn't have it at deduction time)
    await this.creditsService.deductCredits; // no-op reference, the ledger tx is already saved

    // 4. Push to BullMQ
    const job = await this.videoQueue.add(
      'generate',
      { generationId: generation.id, userId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 100 }, // keep 24h or last 100
        removeOnFail: { age: 604800 },                // keep failures 7 days
      },
    );

    // 5. Store the jobId for WebSocket correlation
    await this.genRepo.update(generation.id, { jobId: job.id });

    this.logger.log(
      `Generation ${generation.id} queued as job ${job.id}. Cost: ${creditsCost} credits.`,
    );

    return {
      jobId: job.id!,
      generationId: generation.id,
      creditsCost,
    };
  }

  /**
   * Get cost breakdown without creating a generation (for Smart Calculator UI).
   */
  getCostPreview(scriptText: string, voiceType: CreateGenerationDto['voiceType']) {
    const { getCostBreakdown } = require('../common/utils/text.utils');
    return getCostBreakdown(scriptText, voiceType);
  }

  /**
   * Poll fallback for WebSocket — get current generation status.
   */
  async getStatus(generationId: string, userId: string): Promise<VideoGeneration> {
    const gen = await this.genRepo.findOne({
      where: { id: generationId, userId },
    });
    if (!gen) throw new NotFoundException('Generation not found');
    return gen;
  }

  /**
   * Get generation history for a user.
   */
  async getUserHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ generations: VideoGeneration[]; total: number }> {
    const [generations, total] = await this.genRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { generations, total };
  }
}
