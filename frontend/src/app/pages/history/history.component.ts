import { Component, OnInit, signal, inject } from '@angular/core';
import { SlicePipe, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { VideoGeneration, GenerationStatus } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [SlicePipe, DatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly generations = signal<VideoGeneration[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly GenerationStatus = GenerationStatus;

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  private async loadHistory(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      // Fetching first 50 for now
      const res = await this.api.get<{ generations: VideoGeneration[]; total: number }>(
        '/generations/history',
        { page: 1, limit: 50 },
      );
      const mappedGenerations = res.generations.map(gen => {
        if (gen.outputUrl && gen.outputUrl.startsWith('/')) {
          return { ...gen, outputUrl: `${environment.wsUrl}${gen.outputUrl}` };
        }
        return gen;
      });
      this.generations.set(mappedGenerations);
      this.total.set(res.total);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load history');
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
}
