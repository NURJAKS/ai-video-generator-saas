import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { ProgressPayload } from '../models/api.models';

/**
 * WebSocket service for real-time progress updates.
 *
 * Connects to the NestJS ProgressGateway on the `/progress` namespace.
 * Each generation job gets its own Socket.io "room" keyed by jobId.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly destroy$ = new Subject<void>();

  /**
   * Connect to the WebSocket server and join the job room.
   * Returns an Observable that emits ProgressPayload updates.
   *
   * Usage:
   *   this.wsService.joinJob(jobId).subscribe(progress => { ... });
   */
  joinJob(jobId: string): Observable<ProgressPayload> {
    return new Observable<ProgressPayload>((subscriber) => {
      // Disconnect any existing socket first
      this.disconnect();

      // Connect to the /progress namespace
      this.socket = io(`${environment.wsUrl}/progress`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      this.socket.on('connect', () => {
        console.log('[WS] Connected, joining job room:', jobId);
        this.socket!.emit('join', jobId);
      });

      this.socket.on('progress', (data: ProgressPayload) => {
        subscriber.next(data);

        // Auto-complete the observable if the job is done or failed
        if (data.percent === 100 || data.percent === -1) {
          subscriber.complete();
        }
      });

      this.socket.on('connect_error', (err) => {
        console.error('[WS] Connection error:', err.message);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[WS] Disconnected:', reason);
      });

      // Cleanup on unsubscribe
      return () => {
        if (this.socket) {
          this.socket.emit('leave', jobId);
          this.disconnect();
        }
      };
    });
  }

  /** Disconnect and clean up the socket */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
