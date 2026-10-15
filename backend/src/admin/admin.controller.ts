import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { AdminTopUpDto } from './dto/admin-topup.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get platform dashboard statistics' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Search users' })
  async searchUsers(
    @Query('q') query = '',
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.searchUsers(query, page, limit);
  }

  @Patch('users/:id/toggle-block')
  @ApiOperation({ summary: 'Block or unblock a user' })
  async toggleBlock(@Param('id') userId: string) {
    return this.adminService.toggleBlockUser(userId);
  }

  @Post('users/:id/topup')
  @ApiOperation({ summary: 'Manually top up credits for a user' })
  async topUp(
    @Param('id') userId: string,
    @Body() dto: AdminTopUpDto,
  ) {
    return this.adminService.adminTopUp(userId, dto.amount, dto.note);
  }

  @Get('generations')
  @ApiOperation({ summary: 'Get recent generation logs (last 50)' })
  async getGenerations(@Query('limit') limit = 50) {
    return this.adminService.getRecentGenerations(limit);
  }

  @Post('generations/cancel-stuck')
  @ApiOperation({ summary: 'Cancel all stuck processing/pending generations and refund credits' })
  async cancelStuck() {
    return this.adminService.cancelStuckGenerations();
  }
}
