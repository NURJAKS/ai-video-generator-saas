// ── User ─────────────────────────────────────────────────────

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isBlocked: boolean;
  creditBalance: number;
  createdAt: string;
  updatedAt: string;
}

// ── Auth ─────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

// ── Video Generation ─────────────────────────────────────────

export enum VoiceType {
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export enum VideoFormat {
  LANDSCAPE = 'landscape',
  PORTRAIT = 'portrait',
}

export enum GenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface CreateGenerationPayload {
  scriptText: string;
  voiceType: VoiceType;
  videoFormat: VideoFormat;
  transitionFrequency: number;
  cinematicStyle: string;
}

export interface GenerationResponse {
  jobId: string;
  generationId: string;
  creditsCost: number;
}

export interface VideoGeneration {
  id: string;
  userId: string;
  scriptText: string;
  voiceType: VoiceType;
  videoFormat: VideoFormat;
  transitionFrequency: number;
  cinematicStyle: string;
  estimatedDurationSec: number;
  creditsCost: number;
  status: GenerationStatus;
  progress: number;
  progressStatus: string | null;
  outputUrl: string | null;
  errorMessage: string | null;
  pipelineState: Record<string, any> | null;
  jobId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Cost Preview ─────────────────────────────────────────────

export interface CostPreview {
  wordCount: number;
  durationMin: number;
  durationSec: number;
  voiceType: VoiceType;
  ratePerMinute: number;
  creditCost: number;
}

// ── Credits & Ledger ─────────────────────────────────────────

export enum TransactionType {
  PURCHASE = 'purchase',
  DEDUCTION = 'deduction',
  REFUND = 'refund',
  ADMIN_TOPUP = 'admin_topup',
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  videoGenerationId: string | null;
  creditPackageId: string | null;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  isActive: boolean;
}

export interface PaginatedResponse<T> {
  total: number;
  [key: string]: T[] | number;
}

// ── WebSocket Progress ───────────────────────────────────────

export interface ProgressPayload {
  percent: number;      // 0–100, or -1 for failure
  status: string;       // "Generating audio", "Complete", "Failed"
  detail?: string;      // "Image 3/15"
  outputUrl?: string;   // only on completion
  error?: string;       // only on failure
}

// ── Admin ────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  totalGenerations: number;
  completedGenerations: number;
  failedGenerations: number;
  totalCreditsIssued: number;
  totalCreditsConsumed: number;
}
