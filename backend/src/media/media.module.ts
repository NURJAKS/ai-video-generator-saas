import { Module } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';
import { StorageService } from './storage.service';

@Module({
  providers: [FfmpegService, StorageService],
  exports: [FfmpegService, StorageService],
})
export class MediaModule {}
