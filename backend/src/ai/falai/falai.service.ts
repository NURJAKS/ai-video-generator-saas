import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoFormat } from '../../generation/entities/video-generation.entity';

@Injectable()
export class FalAiService {
  private readonly logger = new Logger(FalAiService.name);
  private readonly apiKey: string;

  /** Max concurrent image generation requests */
  private readonly MAX_CONCURRENCY = 1;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FAL_API_KEY')!;
  }

  private imageCounter = 0;

  /**
   * Reads a local dummy image (1.jpg, 2.jpg, 3.jpg, 4.jpg) in a round-robin fashion.
   */
  async generateImage(prompt: string, videoFormat: VideoFormat): Promise<Buffer> {
    const fs = require('fs/promises');
    const path = require('path');
    
    // Cycle through 1 to 4
    const index = (this.imageCounter % 4) + 1;
    this.imageCounter++;

    this.logger.debug(`Reading dummy image ${index}.jpg for prompt: ${prompt.substring(0, 40)}...`);

    const imagePath = path.join(process.cwd(), 'assets', 'dummy', `${index}.jpg`);
    return await fs.readFile(imagePath);
  }

  /**
   * Generates multiple images with concurrency limiting.
   */
  async generateImagesBatch(
    prompts: string[],
    videoFormat: VideoFormat,
  ): Promise<Buffer[]> {
    const results: Buffer[] = [];
    const queue = [...prompts.map((p, i) => ({ prompt: p, index: i }))];

    // Process in batches of MAX_CONCURRENCY
    while (queue.length > 0) {
      const batch = queue.splice(0, this.MAX_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((item) => this.generateImage(item.prompt, videoFormat)),
      );
      results.push(...batchResults);
    }

    this.logger.log(`Generated ${results.length} images`);
    return results;
  }
}
