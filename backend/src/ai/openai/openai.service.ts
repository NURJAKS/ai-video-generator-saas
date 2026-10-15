import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * A scene parsed from the user's script by ChatGPT.
 */
export interface Scene {
  index: number;
  text: string;           // narration text for this scene
  imagePrompt: string;    // visual description for image generation
  durationSec: number;    // estimated duration in seconds
  speaker?: string;       // the character speaking (e.g., 'Narrator', 'Speaker 1')
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY')!;
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o')!;
  }

  /**
   * Analyzes the user's script and breaks it into scenes.
   * Each scene gets narration text and an image generation prompt.
   */
  async analyzeScript(scriptText: string): Promise<Scene[]> {
    const systemPrompt = `You are a video production assistant. Break the following text into scenes for a narrated video.

For each scene, provide:
1. "text" — the narration text (the original words, split logically)
2. "speaker" — the name of the character/person speaking this text (e.g. "Narrator", "Person A", "Voice").
3. "imagePrompt" — a detailed visual description for AI image generation (cinematic, descriptive, no text in image)
4. "durationSec" — estimated narration duration based on ~150 words/minute

Return a JSON object containing a "scenes" array. No markdown, no explanation — only valid JSON.

Example output:
{
  "scenes": [
    {
      "index": 1,
      "text": "The sun set over the ancient city...",
      "speaker": "Narrator",
      "imagePrompt": "A cinematic wide shot of an ancient Mediterranean city at golden hour, warm sunlight casting long shadows over stone buildings",
      "durationSec": 8
    }
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: scriptText },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    const parsed = JSON.parse(content);
    // Extract scenes robustly depending on how OpenAI wraps the JSON object
    const scenes: Scene[] = parsed.scenes || parsed.data || (Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray));

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      this.logger.error(`OpenAI returned invalid scenes format. Content: ${content}`);
      throw new Error('OpenAI returned no scenes');
    }

    this.logger.log(`Script analyzed: ${scenes.length} scenes extracted`);
    return scenes;
  }
}
