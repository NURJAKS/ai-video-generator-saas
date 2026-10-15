import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export interface ProgressPayload {
  percent: number;       // 0–100, or -1 for failure
  status: string;        // "Generating audio", "Complete", "Failed"
  detail?: string;       // "Image 3/15"
  outputUrl?: string;    // only on completion
  error?: string;        // only on failure
}

@WebSocketGateway({
  namespace: '/progress',
  cors: {
    origin: '*', // tighten in production
  },
})
export class ProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ProgressGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Client joins a room scoped to their jobId.
   * Angular sends: socket.emit('join', jobId)
   */
  @SubscribeMessage('join')
  handleJoin(client: Socket, jobId: string) {
    client.join(`job:${jobId}`);
    this.logger.debug(`Client ${client.id} joined room job:${jobId}`);
  }

  /**
   * Client leaves a room (cleanup).
   */
  @SubscribeMessage('leave')
  handleLeave(client: Socket, jobId: string) {
    client.leave(`job:${jobId}`);
    this.logger.debug(`Client ${client.id} left room job:${jobId}`);
  }

  /**
   * Called by the BullMQ VideoProcessor to broadcast progress updates.
   * Only clients in the matching room receive the event.
   */
  emitProgress(jobId: string, data: ProgressPayload): void {
    this.server.to(`job:${jobId}`).emit('progress', data);
  }
}
