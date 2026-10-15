import { VoiceType } from '../../generation/entities/video-generation.entity';

/** Average speaking rate in words per minute */
const WORDS_PER_MINUTE = 150;

/** Credit rates per minute of audio */
const CREDIT_RATES: Record<VoiceType, number> = {
  [VoiceType.BASIC]: 1,     // OpenAI TTS
  [VoiceType.PREMIUM]: 6,   // ElevenLabs
};

/**
 * Counts words in a text string.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Estimates the audio duration in seconds from a word count.
 */
export function estimateDurationSec(wordCount: number): number {
  return Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);
}

/**
 * Estimates the audio duration in minutes (rounded up).
 */
export function estimateDurationMin(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

/**
 * Calculates the credit cost for a generation.
 *
 * Formula: ceil(wordCount / 150) * rate
 *   - Basic  (OpenAI TTS):  1 credit/min
 *   - Premium (ElevenLabs): 6 credits/min
 */
export function calculateCreditCost(text: string, voiceType: VoiceType): number {
  const words = countWords(text);
  const minutes = estimateDurationMin(words);
  return minutes * CREDIT_RATES[voiceType];
}

/**
 * Returns a full cost breakdown for the Smart Calculator UI.
 */
export function getCostBreakdown(text: string, voiceType: VoiceType) {
  const wordCount = countWords(text);
  const durationMin = estimateDurationMin(wordCount);
  const durationSec = estimateDurationSec(wordCount);
  const creditCost = durationMin * CREDIT_RATES[voiceType];

  return {
    wordCount,
    durationMin,
    durationSec,
    voiceType,
    ratePerMinute: CREDIT_RATES[voiceType],
    creditCost,
  };
}
