import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum GenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum VoiceType {
  BASIC = 'basic',       // OpenAI TTS — 1 credit/min
  PREMIUM = 'premium',   // ElevenLabs — 6 credits/min
}

export enum VideoFormat {
  LANDSCAPE = 'landscape',  // 16:9
  PORTRAIT = 'portrait',    // 9:16
}

@Entity('video_generations')
export class VideoGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.videoGenerations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // ── Generation Config ─────────────────────────────────

  @Column({ type: 'text' })
  scriptText: string;

  @Column({ type: 'enum', enum: VoiceType })
  voiceType: VoiceType;

  @Column({ type: 'enum', enum: VideoFormat })
  videoFormat: VideoFormat;

  /** How often to change the image (in seconds) */
  @Column({ type: 'int', default: 5 })
  transitionFrequency: number;

  /** Cinematic style keyword for Fal.ai image generation */
  @Column({ type: 'varchar', length: 100 })
  cinematicStyle: string;

  // ── Cost & Duration ───────────────────────────────────

  /** Estimated video length in seconds (from word count) */
  @Column({ type: 'int' })
  estimatedDurationSec: number;

  /** Credits charged for this generation */
  @Column({ type: 'int' })
  creditsCost: number;

  // ── Progress Tracking ─────────────────────────────────

  @Column({ type: 'enum', enum: GenerationStatus, default: GenerationStatus.PENDING })
  status: GenerationStatus;

  /** 0–100 progress percentage */
  @Column({ type: 'float', default: 0 })
  progress: number;

  /** Human-readable status text, e.g. "Generating audio" */
  @Column({ type: 'varchar', length: 255, nullable: true })
  progressStatus: string | null;

  // ── Output ────────────────────────────────────────────

  /** URL/path to the final MP4 file */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  outputUrl: string | null;

  /** Error message if the pipeline failed */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * Tracks per-step completion state for crash recovery.
   * Example: { textAnalysis: true, audioGenerated: true, imagesGenerated: false }
   */
  @Column({ type: 'jsonb', nullable: true })
  pipelineState: Record<string, any> | null;

  /** BullMQ job ID for correlation */
  @Column({ type: 'varchar', length: 255, nullable: true })
  jobId: string | null;

  // ── Timestamps ────────────────────────────────────────

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
