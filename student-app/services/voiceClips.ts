/**
 * O'zbekcha ovozli jumlalar (voicePraise.ts uchun).

 * Ovoz: ElevenLabs "Sardor" (eleven_v4), Abdulloh tanlovi. Fayllar: assets/sounds/v2/voice/*.mp3.
 * Har fayl yonida — aytiladigan matn.
 */
export type VoiceGroup = 'correct' | 'wrong' | 'complete' | 'levelup' | 'gameWin' | 'gameLose' | 'homework';

export const VOICE_SOURCES: Record<VoiceGroup, number[]> = {
  correct: [
    require('@/assets/sounds/v2/voice/correct_barakalla.mp3'), // Barakalla!
    require('@/assets/sounds/v2/voice/correct_qoyil.mp3'), // Qoyil!
    require('@/assets/sounds/v2/voice/correct_ofarin.mp3'), // Ofarin!
    require('@/assets/sounds/v2/voice/correct_zor.mp3'), // Zo'r!
    require('@/assets/sounds/v2/voice/correct_toppa.mp3'), // To'ppa-to'g'ri!
    require('@/assets/sounds/v2/voice/correct_molodes.mp3'), // Molodes!
    require('@/assets/sounds/v2/voice/correct_ajoyib.mp3'), // Ajoyib, shunday davom eting!
  ],
  wrong: [
    require('@/assets/sounds/v2/voice/wrong_hechqisi.mp3'), // Hechqisi yo'q, yana bir urinib ko'ring.
    require('@/assets/sounds/v2/voice/wrong_organish.mp3'), // Xato qilish ham o'rganishning bir qismi.
  ],
  complete: [
    require('@/assets/sounds/v2/voice/complete_tugadi.mp3'), // Dars tugadi! Zo'r ishladingiz!
    require('@/assets/sounds/v2/voice/complete_tugatdingiz.mp3'), // Barakalla, bugungi darsni tugatdingiz!
  ],
  levelup: [
    require('@/assets/sounds/v2/voice/levelup_daraja.mp3'), // Tabriklayman! Yangi darajaga chiqdingiz!
  ],
  gameWin: [
    require('@/assets/sounds/v2/voice/gameWin_galaba.mp3'), // G'alaba! Qoyil!
    require('@/assets/sounds/v2/voice/gameWin_yutdingiz.mp3'), // Zo'r o'yin, siz yutdingiz!
  ],
  gameLose: [
    require('@/assets/sounds/v2/voice/gameLose_yana.mp3'), // Hechqisi yo'q, yana bir bor o'ynaymiz!
  ],
  homework: [
    require('@/assets/sounds/v2/voice/homework_vazifa.mp3'), // Vazifa tekshirildi. Barakalla!
  ],
};
