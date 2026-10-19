/**
 * O'zbekcha ovozli jumlalar ro'yxati (voicePraise.ts uchun).
 * Fayllar: assets/sounds/v2/voice/*.mp3 — matnlari izohda.
 */
export type VoiceGroup = 'correct' | 'wrong' | 'complete' | 'levelup' | 'gameWin' | 'gameLose' | 'homework';

export const VOICE_SOURCES: Record<VoiceGroup, number[]> = {
  correct: [],
  wrong: [],
  complete: [],
  levelup: [],
  gameWin: [],
  gameLose: [],
  homework: [],
};
