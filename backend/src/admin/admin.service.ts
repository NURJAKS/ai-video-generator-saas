import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { VideoGeneration } from '../generation/entities/video-generation.entity';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(VideoGeneration)
    private readonly genRepo: Repository<VideoGeneration>,
    private readonly creditsService: CreditsService,
  ) {}

  // ── Dashboard Stats ───────────────────────────────────

  async getDashboardStats() {
    const totalUsers = await this.userRepo.count();
    const totalGenerations = await this.genRepo.count();

    const completedGenerations = await this.genRepo.count({
      where: { status: 'completed' as any },
    });

    const failedGenerations = await this.genRepo.count({
      where: { status: 'failed' as any },
    });

    // Total credits distributed (sum of all purchase + admin_topup transactions)
    const result = await this.userRepo
      .createQueryBuilder('user')
      .select('SUM(user.creditBalance)', 'totalCreditsInCirculation')
      .getRawOne();

    return {
      totalUsers,
      totalGenerations,
      completedGenerations,
      failedGenerations,
      successRate: totalGenerations > 0
        ? ((completedGenerations / totalGenerations) * 100).toFixed(1) + '%'
        : 'N/A',
      totalCreditsInCirculation: parseInt(result?.totalCreditsInCirculation || '0', 10),
    };
  }

  // ── User Management ───────────────────────────────────

  async searchUsers(query: string, page = 1, limit = 20) {
    const [users, total] = await this.userRepo.findAndCount({
      where: query
        ? [
            { email: ILike(`%${query}%`) },
            { displayName: ILike(`%${query}%`) },
          ]
        : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'email', 'displayName', 'role', 'isBlocked', 'creditBalance', 'createdAt'],
    });

    return { users, total };
  }

  async toggleBlockUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.isBlocked = !user.isBlocked;
    return this.userRepo.save(user);
  }

  async adminTopUp(userId: string, amount: number, note: string) {
    return this.creditsService.adminTopUp(userId, amount, note);
  }

  // ── Generation Logs ───────────────────────────────────

  async getRecentGenerations(limit = 50) {
    return this.genRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
      select: {
        id: true,
        status: true,
        voiceType: true,
        creditsCost: true,
        progress: true,
        progressStatus: true,
        outputUrl: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        user: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    });
  }

  /**
   * Cancels all stuck processing/pending generations and refunds credits.
   */
  async cancelStuckGenerations(): Promise<{ cancelled: number; refunded: number }> {
    const stuck = await this.genRepo.find({
      where: [
        { status: 'processing' as any },
        { status: 'pending' as any },
      ],
    });

    let refundedTotal = 0;

    for (const gen of stuck) {
      await this.genRepo.update(gen.id, {
        status: 'failed' as any,
        errorMessage: 'Cancelled by admin',
        completedAt: new Date(),
      });

      try {
        await this.creditsService.refundCredits(
          gen.userId,
          gen.creditsCost,
          gen.id,
          'Admin cancelled stuck generation',
        );
        refundedTotal += gen.creditsCost;
      } catch (e) {
        // Already refunded or user not found — skip
      }
    }

    return { cancelled: stuck.length, refunded: refundedTotal };
  }
}
