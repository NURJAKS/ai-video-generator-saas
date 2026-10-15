import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { VideoGeneration, GenerationStatus } from '../../core/models/api.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, SlicePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly user = this.auth.user;
  readonly recentGenerations = signal<VideoGeneration[]>([]);
  readonly loading = signal(true);

  readonly GenerationStatus = GenerationStatus;

  async ngOnInit(): Promise<void> {
    await this.auth.refreshBalance();
    await this.loadRecentGenerations();
  }

  private async loadRecentGenerations(): Promise<void> {
    try {
      const res = await this.api.get<{ generations: VideoGeneration[]; total: number }>(
        '/generations/history',
        { page: 1, limit: 5 },
      );
      this.recentGenerations.set(res.generations);
    } catch {
      // silently fail
    } finally {
      this.loading.set(false);
    }
  }

  getStatusBadgeClass(status: GenerationStatus): string {
    switch (status) {
      case GenerationStatus.COMPLETED: return 'badge-success';
      case GenerationStatus.PROCESSING: return 'badge-accent';
      case GenerationStatus.PENDING: return 'badge-warning';
      case GenerationStatus.FAILED: return 'badge-danger';
      default: return '';
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
