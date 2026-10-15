import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Low-level HTTP client wrapping fetch().
 * Automatically prepends the API base URL and injects JWT from localStorage.
 *
 * All methods throw on non-2xx responses with a parsed error message.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  // ── Public API ──────────────────────────────────────────

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, { method: 'DELETE' });
  }

  // ── Internals ───────────────────────────────────────────

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const token = localStorage.getItem('vg_access_token');

    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      const message = errorBody?.message || errorBody?.error || response.statusText;
      throw new ApiError(
        response.status,
        Array.isArray(message) ? message.join(', ') : message,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private buildUrl(path: string, params?: Record<string, string | number>): string {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        url.searchParams.set(key, String(val));
      });
    }

    return url.toString();
  }
}

/**
 * Typed API error with status code.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
