import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { VideoProcessor } from './processors/video.processor';
import { VideoGeneration } from './entities/video-generation.entity';
import { CreditsModule } from '../credits/credits.module';
import { AiModule } from '../ai/ai.module';
import { MediaModule } from '../media/media.module';
import { WebsocketModule } from '../websocket/websocket.module';

export const VIDEO_QUEUE = 'video-generation';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideoGeneration]),
    BullModule.registerQueue({ name: VIDEO_QUEUE }),
    CreditsModule,
    AiModule,
    MediaModule,
    WebsocketModule,
  ],
  controllers: [GenerationController],
  providers: [GenerationService, VideoProcessor],
  exports: [GenerationService],
})
export class GenerationModule {}
