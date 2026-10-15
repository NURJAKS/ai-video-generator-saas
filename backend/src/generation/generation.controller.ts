import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GenerationService } from './generation.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { CostPreviewDto } from './dto/cost-preview.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Generations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('generations')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new video generation (deducts credits)' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateGenerationDto,
  ) {
    return this.generationService.createGeneration(user.id, dto);
  }

  @Post('preview-cost')
  @ApiOperation({ summary: 'Get cost preview without generating (for Smart Calculator)' })
  async previewCost(@Body() dto: CostPreviewDto) {
    return this.generationService.getCostPreview(dto.scriptText, dto.voiceType);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get generation status (polling fallback for WebSocket)' })
  async getStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.generationService.getStatus(id, user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user generation history' })
  async getHistory(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.generationService.getUserHistory(user.id, page, limit);
  }
}
