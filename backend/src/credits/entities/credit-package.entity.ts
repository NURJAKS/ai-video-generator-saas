import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('credit_packages')
export class CreditPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-readable name, e.g. "Starter", "Pro", "Enterprise" */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Number of credits in this package */
  @Column({ type: 'int' })
  credits: number;

  /** Price in USD */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceUsd: number;

  /** Soft-delete: deactivated packages are hidden from the storefront */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
