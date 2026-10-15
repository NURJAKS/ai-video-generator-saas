import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { VideoGeneration } from '../../generation/entities/video-generation.entity';

export enum TransactionType {
  PURCHASE = 'purchase',
  DEDUCTION = 'deduction',
  REFUND = 'refund',
  ADMIN_TOPUP = 'admin_topup',
}

@Entity('ledger_transactions')
export class LedgerTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.ledgerTransactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  videoGenerationId: string | null;

  @ManyToOne(() => VideoGeneration, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'videoGenerationId' })
  videoGeneration: VideoGeneration | null;

  @Column({ type: 'uuid', nullable: true })
  creditPackageId: string | null;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  /**
   * Signed integer:
   *   positive → credits flowing IN  (purchase, refund, admin_topup)
   *   negative → credits flowing OUT (deduction)
   */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int' })
  balanceBefore: number;

  @Column({ type: 'int' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  /** Arbitrary metadata — e.g. package details, refund reason, admin notes */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
