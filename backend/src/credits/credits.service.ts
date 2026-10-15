import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LedgerTransaction, TransactionType } from './entities/ledger-transaction.entity';
import { CreditPackage } from './entities/credit-package.entity';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LedgerTransaction)
    private readonly ledgerRepo: Repository<LedgerTransaction>,
    @InjectRepository(CreditPackage)
    private readonly packageRepo: Repository<CreditPackage>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Balance ───────────────────────────────────────────

  async getBalance(userId: string): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user.creditBalance;
  }

  async getLedgerHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ transactions: LedgerTransaction[]; total: number }> {
    const [transactions, total] = await this.ledgerRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { transactions, total };
  }

  // ── Credit Deduction (CRITICAL — row-level locking) ───

  /**
   * Atomically deducts credits using SELECT ... FOR UPDATE.
   * This is the core financial transaction — must be atomic.
   *
   * @param userId         - user to deduct from
   * @param amount         - positive number of credits to deduct
   * @param description    - human-readable reason
   * @param videoGenerationId - optional link to the generation that triggered this
   * @returns the created LedgerTransaction
   * @throws BadRequestException if insufficient credits
   */
  async deductCredits(
    userId: string,
    amount: number,
    description: string,
    videoGenerationId?: string,
  ): Promise<LedgerTransaction> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Lock the user row to prevent concurrent deductions
      const user = await manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write') // SELECT ... FOR UPDATE
        .where('user.id = :id', { id: userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2. Sufficiency check (under lock)
      if (user.creditBalance < amount) {
        throw new BadRequestException(
          `Insufficient credits. Required: ${amount}, Available: ${user.creditBalance}`,
        );
      }

      // 3. Create ledger entry (negative amount = outflow)
      const tx = manager.create(LedgerTransaction, {
        userId,
        videoGenerationId: videoGenerationId || null,
        type: TransactionType.DEDUCTION,
        amount: -amount,
        balanceBefore: user.creditBalance,
        balanceAfter: user.creditBalance - amount,
        description,
      });
      await manager.save(tx);

      // 4. Update denormalized balance cache
      await manager.update(User, userId, {
        creditBalance: user.creditBalance - amount,
      });

      this.logger.log(
        `Deducted ${amount} credits from user ${userId}. Balance: ${user.creditBalance} → ${user.creditBalance - amount}`,
      );

      return tx;
    });
  }

  // ── Credit Refund (compensatory transaction) ──────────

  /**
   * Refunds credits back to the user. Called by the worker on pipeline failure.
   */
  async refundCredits(
    userId: string,
    amount: number,
    videoGenerationId: string,
    reason: string,
  ): Promise<LedgerTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const tx = manager.create(LedgerTransaction, {
        userId,
        videoGenerationId,
        type: TransactionType.REFUND,
        amount: +amount, // positive = inflow
        balanceBefore: user.creditBalance,
        balanceAfter: user.creditBalance + amount,
        description: `Refund: ${reason}`,
      });
      await manager.save(tx);

      await manager.update(User, userId, {
        creditBalance: user.creditBalance + amount,
      });

      this.logger.log(
        `Refunded ${amount} credits to user ${userId}. Balance: ${user.creditBalance} → ${user.creditBalance + amount}`,
      );

      return tx;
    });
  }

  // ── Purchase Credits ──────────────────────────────────

  /**
   * Simulates purchasing a credit package (no real payment gateway yet).
   */
  async purchaseCredits(
    userId: string,
    packageId: string,
  ): Promise<LedgerTransaction> {
    const creditPackage = await this.packageRepo.findOne({
      where: { id: packageId, isActive: true },
    });

    if (!creditPackage) {
      throw new NotFoundException('Credit package not found or inactive');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const tx = manager.create(LedgerTransaction, {
        userId,
        creditPackageId: creditPackage.id,
        type: TransactionType.PURCHASE,
        amount: +creditPackage.credits,
        balanceBefore: user.creditBalance,
        balanceAfter: user.creditBalance + creditPackage.credits,
        description: `Purchased "${creditPackage.name}" package (${creditPackage.credits} credits)`,
        metadata: {
          packageName: creditPackage.name,
          priceUsd: creditPackage.priceUsd,
        },
      });
      await manager.save(tx);

      await manager.update(User, userId, {
        creditBalance: user.creditBalance + creditPackage.credits,
      });

      return tx;
    });
  }

  // ── Admin Top-Up ──────────────────────────────────────

  /**
   * Admin manually adds credits to a user's account.
   */
  async adminTopUp(
    userId: string,
    amount: number,
    adminNote: string,
  ): Promise<LedgerTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const tx = manager.create(LedgerTransaction, {
        userId,
        type: TransactionType.ADMIN_TOPUP,
        amount: +amount,
        balanceBefore: user.creditBalance,
        balanceAfter: user.creditBalance + amount,
        description: `Admin top-up: ${adminNote}`,
      });
      await manager.save(tx);

      await manager.update(User, userId, {
        creditBalance: user.creditBalance + amount,
      });

      return tx;
    });
  }

  // ── Packages ──────────────────────────────────────────

  async getActivePackages(): Promise<CreditPackage[]> {
    return this.packageRepo.find({
      where: { isActive: true },
      order: { credits: 'ASC' },
    });
  }
}
