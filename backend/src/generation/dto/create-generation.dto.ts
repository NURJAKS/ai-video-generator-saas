import {
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoiceType, VideoFormat } from '../entities/video-generation.entity';

export class CreateGenerationDto {
  @ApiProperty({ description: 'The story/script text for the video' })
  @IsString()
  @MinLength(20, { message: 'Script must be at least 20 characters' })
  scriptText: string;

  @ApiProperty({ enum: VoiceType, description: 'Voice type: basic (OpenAI) or premium (ElevenLabs)' })
  @IsEnum(VoiceType)
  voiceType: VoiceType;

  @ApiProperty({ enum: VideoFormat, description: 'Video format: landscape (16:9) or portrait (9:16)' })
  @IsEnum(VideoFormat)
  videoFormat: VideoFormat;

  @ApiProperty({ description: 'Image transition frequency in seconds', default: 5 })
  @IsInt()
  @Min(3)
  @Max(30)
  transitionFrequency: number;

  @ApiProperty({ description: 'Cinematic style for image generation', example: 'cinematic noir' })
  @IsString()
  cinematicStyle: string;
}
