import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR', './uploads')!;
  }

  /**
   * Ensures the upload directories exist.
   */
  async ensureDirectories(): Promise<void> {
    const dirs = ['videos', 'temp'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.uploadDir, dir), { recursive: true });
    }
  }

  /**
   * Get the absolute path for a relative storage path.
   */
  getAbsolutePath(relativePath: string): string {
    // Strip leading /uploads/ if present
    const clean = relativePath.replace(/^\/uploads\//, '');
    return path.resolve(this.uploadDir, clean);
  }

  /**
   * Check if a file exists in storage.
   */
  async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.getAbsolutePath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file from storage.
   */
  async delete(relativePath: string): Promise<void> {
    try {
      await fs.unlink(this.getAbsolutePath(relativePath));
    } catch (err) {
      this.logger.warn(`Failed to delete file: ${relativePath}`);
    }
  }
}
