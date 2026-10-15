import { Injectable, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  UserRole,
} from '../models/api.models';
import { ApiService } from './api.service';

const TOKEN_KEY = 'vg_access_token';
const USER_KEY = 'vg_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Current user (reactive signal) */
  private readonly _user = signal<User | null>(this.loadUser());
  private readonly _loading = signal(false);

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isAdmin = computed(() => this._user()?.role === UserRole.ADMIN);

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
  ) {
    // Persist user changes to localStorage
    effect(() => {
      const u = this._user();
      if (u) {
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    });
  }

  /** Returns the stored JWT token */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Login with email & password */
  async login(payload: LoginPayload): Promise<void> {
    this._loading.set(true);
    try {
      const res = await this.api.post<AuthResponse>('/auth/login', payload);
      this.handleAuthSuccess(res);
    } finally {
      this._loading.set(false);
    }
  }

  /** Register a new account */
  async register(payload: RegisterPayload): Promise<void> {
    this._loading.set(true);
    try {
      const res = await this.api.post<AuthResponse>('/auth/register', payload);
      this.handleAuthSuccess(res);
    } finally {
      this._loading.set(false);
    }
  }

  /** Logout and redirect to login page */
  logout(): void {
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  /** Update the cached user (e.g. after balance change) */
  updateUser(partial: Partial<User>): void {
    const current = this._user();
    if (current) {
      this._user.set({ ...current, ...partial });
    }
  }

  /** Refresh balance from API */
  async refreshBalance(): Promise<void> {
    try {
      const res = await this.api.get<{ balance: number }>('/credits/balance');
      this.updateUser({ creditBalance: res.balance });
    } catch {
      // silently fail — balance will refresh next time
    }
  }

  // ── Private ──────────────────────────────────────────────

  private handleAuthSuccess(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this._user.set(res.user);
    this.router.navigate(['/dashboard']);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
