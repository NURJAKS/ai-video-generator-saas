import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { VideoGeneration } from '../generation/entities/video-generation.entity';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, VideoGeneration]),
    CreditsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
