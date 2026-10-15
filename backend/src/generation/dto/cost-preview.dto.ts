import { IsString, IsEnum, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoiceType } from '../entities/video-generation.entity';

export class CostPreviewDto {
  @ApiProperty({ description: 'The script text to estimate cost for' })
  @IsString()
  @MinLength(1)
  scriptText: string;

  @ApiProperty({ enum: VoiceType })
  @IsEnum(VoiceType)
  voiceType: VoiceType;
}
