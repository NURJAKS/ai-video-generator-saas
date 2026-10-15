import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { LedgerTransaction } from '../../credits/entities/ledger-transaction.entity';
import { VideoGeneration } from '../../generation/entities/video-generation.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;

  /**
   * Denormalized cache of the user's credit balance.
   * Source of truth is always SUM(ledger_transactions.amount).
   * Updated atomically inside the same DB transaction that inserts a ledger row.
   */
  @Column({ type: 'int', default: 0 })
  creditBalance: number;

  @OneToMany(() => LedgerTransaction, (t) => t.user)
  ledgerTransactions: LedgerTransaction[];

  @OneToMany(() => VideoGeneration, (v) => v.user)
  videoGenerations: VideoGeneration[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
