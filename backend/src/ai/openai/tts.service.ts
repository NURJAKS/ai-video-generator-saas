import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAiTtsService {
  private readonly logger = new Logger(OpenAiTtsService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY')!;
  }

  /**
   * Generates audio from text using OpenAI TTS (basic voice tier).
   * Returns raw audio buffer (MP3).
   */
  async generateAudio(text: string, voice = 'alloy'): Promise<Buffer> {
    this.logger.log(`Generating basic TTS audio (${text.length} chars, voice: ${voice})`);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI TTS error (${response.status}): ${errorBody}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    this.logger.log(`TTS audio generated: ${buffer.length} bytes`);
    return buffer;
  }
}
