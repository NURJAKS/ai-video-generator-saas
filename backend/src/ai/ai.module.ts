import { Module } from '@nestjs/common';
import { OpenAiService } from './openai/openai.service';
import { OpenAiTtsService } from './openai/tts.service';
import { ElevenLabsService } from './elevenlabs/elevenlabs.service';
import { FalAiService } from './falai/falai.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  providers: [OpenAiService, OpenAiTtsService, ElevenLabsService, FalAiService],
  exports: [OpenAiService, OpenAiTtsService, ElevenLabsService, FalAiService],
})
export class AiModule {}
