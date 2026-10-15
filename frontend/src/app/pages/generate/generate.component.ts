import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, takeUntil, distinctUntilChanged, combineLatest, startWith, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { VoiceType, VideoFormat, ProgressPayload } from '../../core/models/api.models';
import { environment } from '../../../environments/environment';

/** Credit rate constants (mirroring backend text.utils.ts) */
const WORDS_PER_MINUTE = 150;
const CREDIT_RATES: Record<string, number> = {
  [VoiceType.BASIC]: 1,
  [VoiceType.PREMIUM]: 6,
};

/** Cinematic style options for Fal.ai Flux */
const CINEMATIC_STYLES = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'cinematic noir', label: 'Cinematic Noir' },
  { value: 'hyperrealistic', label: 'Hyper-Realistic' },
  { value: 'anime', label: 'Anime' },
  { value: 'oil painting', label: 'Oil Painting' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: '3d render', label: '3D Render' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'fantasy art', label: 'Fantasy Art' },
  { value: 'comic book', label: 'Comic Book' },
];

const TRANSITION_OPTIONS = [
  { value: 3, label: 'Every 3 seconds' },
  { value: 5, label: 'Every 5 seconds' },
  { value: 7, label: 'Every 7 seconds' },
  { value: 10, label: 'Every 10 seconds' },
  { value: 15, label: 'Every 15 seconds' },
];

@Component({
  selector: 'app-generate',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './generate.component.html',
  styleUrl: './generate.component.scss',
})
export class GenerateComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly ws = inject(WebSocketService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  /** Options data */
  readonly cinematicStyles = CINEMATIC_STYLES;
  readonly transitionOptions = TRANSITION_OPTIONS;
  readonly VoiceType = VoiceType;
  readonly VideoFormat = VideoFormat;

  /** Form */
  form!: FormGroup;

  /** Reactive calculator state */
  readonly wordCount = signal(0);
  readonly durationMin = signal(0);
  readonly durationSec = signal(0);
  readonly creditCost = signal(0);
  readonly ratePerMinute = signal(1);
  readonly estimatedImages = signal(0);

  /** UI state */
  readonly userBalance = computed(() => this.auth.user()?.creditBalance ?? 0);
  readonly hasEnoughCredits = computed(() => this.userBalance() >= this.creditCost());
  readonly isSubmitting = signal(false);

  /** Progress tracking */
  readonly isGenerating = signal(false);
  readonly progressPercent = signal(0);
  readonly progressStatus = signal('');
  readonly progressError = signal<string | null>(null);
  readonly outputUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.form = this.fb.group({
      scriptText: ['', [Validators.required, Validators.minLength(20)]],
      voiceType: [VoiceType.BASIC, Validators.required],
      videoFormat: [VideoFormat.LANDSCAPE, Validators.required],
      transitionFrequency: [5, Validators.required],
      cinematicStyle: ['cinematic', Validators.required],
    });

    // ── Smart Calculator: Reactive cost updates ──────────
    const scriptText$ = this.form.get('scriptText')!.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
    );

    const voiceType$ = this.form.get('voiceType')!.valueChanges.pipe(
      startWith(VoiceType.BASIC),
      distinctUntilChanged(),
    );

    const transition$ = this.form.get('transitionFrequency')!.valueChanges.pipe(
      startWith(5),
      distinctUntilChanged(),
    );

    combineLatest([scriptText$, voiceType$, transition$]).pipe(
      takeUntil(this.destroy$),
      map(([text, voice, transition]) => this.calculateCost(text, voice, transition)),
    ).subscribe(cost => {
      this.wordCount.set(cost.wordCount);
      this.durationMin.set(cost.durationMin);
      this.durationSec.set(cost.durationSec);
      this.creditCost.set(cost.creditCost);
      this.ratePerMinute.set(cost.ratePerMinute);
      this.estimatedImages.set(cost.estimatedImages);
    });

    // Refresh balance on load
    this.auth.refreshBalance();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.ws.disconnect();
  }

  /** Calculate cost locally (mirrors backend text.utils.ts) */
  private calculateCost(text: string, voiceType: string, transitionFreq: number | string) {
    const freq = Number(transitionFreq) || 5;
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const durationMin = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
    const durationSec = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);
    const rate = CREDIT_RATES[voiceType] ?? 1;
    const creditCost = wordCount < 10 ? 0 : durationMin * rate;
    const estimatedImages = durationSec > 0 ? Math.ceil(durationSec / freq) : 0;

    return {
      wordCount,
      durationMin,
      durationSec,
      creditCost,
      ratePerMinute: rate,
      estimatedImages,
    };
  }

  /** Submit: deduct credits, push to BullMQ, start WebSocket */
  async onGenerate(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.progressError.set(null);

    try {
      const payload = {
        ...this.form.value,
        transitionFrequency: Number(this.form.value.transitionFrequency),
      };

      const res = await this.api.post<{
        jobId: string;
        generationId: string;
        creditsCost: number;
      }>('/generations', payload);

      // Update local balance immediately
      this.auth.updateUser({
        creditBalance: this.userBalance() - res.creditsCost,
      });

      // Start progress tracking
      this.isGenerating.set(true);
      this.progressPercent.set(0);
      this.progressStatus.set('Queued...');

      // Subscribe to WebSocket for real-time progress
      this.ws.joinJob(res.jobId).pipe(
        takeUntil(this.destroy$),
      ).subscribe({
        next: (data: ProgressPayload) => {
          if (data.percent === -1) {
            // Failed
            this.progressError.set(data.error || 'Generation failed');
            this.progressPercent.set(0);
            this.progressStatus.set('Failed');
            this.isGenerating.set(false);
            // Balance will be refunded by backend
            this.auth.refreshBalance();
          } else {
            this.progressPercent.set(data.percent);
            this.progressStatus.set(data.status);

            if (data.percent === 100 && data.outputUrl) {
              const fullUrl = data.outputUrl.startsWith('/') 
                ? `${environment.wsUrl}${data.outputUrl}` 
                : data.outputUrl;
              this.outputUrl.set(fullUrl);
              this.isGenerating.set(false);
              this.auth.refreshBalance();
            }
          }
        },
        error: () => {
          this.progressError.set('Lost connection to server');
          this.isGenerating.set(false);
        },
        complete: () => {
          // Observable auto-completes on 100% or -1
        },
      });
    } catch (err: any) {
      this.progressError.set(err.message || 'Failed to start generation');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Reset form after generation */
  resetGeneration(): void {
    this.isGenerating.set(false);
    this.progressPercent.set(0);
    this.progressStatus.set('');
    this.progressError.set(null);
    this.outputUrl.set(null);
  }
}
