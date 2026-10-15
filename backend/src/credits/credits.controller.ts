import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';

@ApiTags('Credits')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current credit balance' })
  async getBalance(@CurrentUser() user: User) {
    const balance = await this.creditsService.getBalance(user.id);
    return { balance };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get paginated ledger transaction history' })
  async getHistory(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.creditsService.getLedgerHistory(user.id, page, limit);
  }

  @Get('packages')
  @ApiOperation({ summary: 'List available credit packages' })
  async getPackages() {
    return this.creditsService.getActivePackages();
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Purchase a credit package' })
  async purchase(
    @CurrentUser() user: User,
    @Body() dto: PurchaseCreditsDto,
  ) {
    return this.creditsService.purchaseCredits(user.id, dto.packageId);
  }
}
