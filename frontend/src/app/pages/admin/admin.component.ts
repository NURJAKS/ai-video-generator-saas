import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe, DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { GenerationStatus } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';

interface DashboardStats {
  totalUsers: number;
  totalGenerations: number;
  completedGenerations: number;
  failedGenerations: number;
  successRate: string;
  totalCreditsInCirculation: number;
}

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isBlocked: boolean;
  creditBalance: number;
  createdAt: string;
}

interface AdminGeneration {
  id: string;
  status: GenerationStatus;
  voiceType: string;
  creditsCost: number;
  outputUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);

  // ── State ───────────────────────────────────────────────
  readonly stats = signal<DashboardStats | null>(null);
  
  readonly users = signal<AdminUser[]>([]);
  readonly usersLoading = signal(true);
  
  readonly generations = signal<AdminGeneration[]>([]);
  readonly gensLoading = signal(true);

  readonly error = signal<string | null>(null);
  
  readonly GenerationStatus = GenerationStatus;
  
  // Active Tab
  readonly activeTab = signal<'users' | 'generations'>('users');

  // Topup State
  readonly topupAmounts = signal<Record<string, number>>({});
  readonly toppingUp = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadStats(),
      this.loadUsers(),
      this.loadGenerations()
    ]);
  }

  // ── Data Loading ────────────────────────────────────────

  async loadStats(): Promise<void> {
    try {
      const res = await this.api.get<DashboardStats>('/admin/dashboard');
      this.stats.set(res);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load dashboard stats');
    }
  }

  async loadUsers(): Promise<void> {
    this.usersLoading.set(true);
    try {
      const res = await this.api.get<{ users: AdminUser[]; total: number }>('/admin/users', { limit: 50 });
      this.users.set(res.users);
      
      // Initialize topup amounts dictionary
      const topups: Record<string, number> = {};
      res.users.forEach(u => topups[u.id] = 100); // default 100 credits
      this.topupAmounts.set(topups);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load users');
    } finally {
      this.usersLoading.set(false);
    }
  }

  async loadGenerations(): Promise<void> {
    this.gensLoading.set(true);
    try {
      const res = await this.api.get<AdminGeneration[]>('/admin/generations', { limit: 50 });
      const mappedGenerations = res.map(gen => {
        if (gen.outputUrl && gen.outputUrl.startsWith('/')) {
          return { ...gen, outputUrl: `${environment.wsUrl}${gen.outputUrl}` };
        }
        return gen;
      });
      this.generations.set(mappedGenerations);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load generations');
    } finally {
      this.gensLoading.set(false);
    }
  }

  // ── Actions ─────────────────────────────────────────────

  async toggleBlockUser(user: AdminUser): Promise<void> {
    try {
      await this.api.patch(`/admin/users/${user.id}/toggle-block`, {});
      // Optimistic update
      this.users.update(users => 
        users.map(u => u.id === user.id ? { ...u, isBlocked: !u.isBlocked } : u)
      );
    } catch (err: any) {
      this.error.set(err.message || 'Failed to toggle block status');
    }
  }

  async topUpUser(user: AdminUser): Promise<void> {
    const amount = this.topupAmounts()[user.id];
    if (!amount || amount <= 0) return;

    this.toppingUp.set(user.id);
    try {
      await this.api.post(`/admin/users/${user.id}/topup`, {
        amount,
        note: 'Admin manual top-up'
      });
      // Refresh users to get new balance
      await this.loadUsers();
      await this.loadStats(); // refresh global circulation
    } catch (err: any) {
      this.error.set(err.message || 'Failed to top up user');
    } finally {
      this.toppingUp.set(null);
    }
  }

  updateTopupAmount(userId: string, amount: number): void {
    this.topupAmounts.update(dict => ({
      ...dict,
      [userId]: amount
    }));
  }

  // ── Cancel Stuck Generations ────────────────────────────
  readonly cancelling = signal(false);

  async cancelStuckGenerations(): Promise<void> {
    this.cancelling.set(true);
    try {
      const res = await this.api.post<{ cancelled: number; refunded: number }>('/admin/generations/cancel-stuck');
      alert(`Cancelled ${res.cancelled} generation(s). Refunded ${res.refunded} credits.`);
      await Promise.all([this.loadGenerations(), this.loadStats()]);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to cancel generations');
    } finally {
      this.cancelling.set(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────

  getStatusBadgeClass(status: GenerationStatus): string {
    switch (status) {
      case GenerationStatus.COMPLETED: return 'badge-success';
      case GenerationStatus.PROCESSING: return 'badge-accent';
      case GenerationStatus.PENDING: return 'badge-warning';
      case GenerationStatus.FAILED: return 'badge-danger';
      default: return '';
    }
  }
}
