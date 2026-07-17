import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

const WIN_SOUND = require('@/assets/sounds/win.wav');
const LOSE_SOUND = require('@/assets/sounds/lose.wav');

// 160-ish qayta ish 13: avval har playSound() chaqiruvida YANGI audio
// elementi yaratilardi (createAudioPlayer + darhol remove()). Bu ayni
// Safari/iOS'da mashhur "faqat bir marta ishlaydi" xatosiga sabab bo'ladi —
// Chrome'dan farqli o'laroq, Safari play() ruxsatini SAHIFA darajasida
// emas, HAR BIR audio ELEMENTI uchun ALOHIDA, haqiqiy foydalanuvchi
// gesture'i ichida "unlock" qiladi. Birinchi marta yaratilgan yangi element
// tasodifan ishlaydi, lekin keyingi har bir chaqiruvda YANA yangi (hali
// unlock qilinmagan) element yaratilib, u jim ishlamay qoladi — xato ham
// tashlanmaydi, chunki bu asinxron `onerror` orqali sodir bo'ladi.
// Yechim: har ovoz uchun bitta pleer obyektini butun sessiya davomida qayta
// ishlatish — birinchi marta unlock bo'lgach, xuddi shu elementni
// currentTime'ni 0'ga qaytarib qayta-qayta play() qilish har doim ishlaydi.
let winPlayer: AudioPlayer | null = null;
let losePlayer: AudioPlayer | null = null;

function playCached(getCached: () => AudioPlayer | null, setCached: (p: AudioPlayer) => void, source: number) {
  try {
    let player = getCached();
    if (!player) {
      player = createAudioPlayer(source);
      setCached(player);
    }
    player.seekTo(0);
    player.play();
  } catch {
    // Ovoz ijro etilmasa ham o'yin natijasiga ta'sir qilmasin.
  }
}

// O'yinda yutganda chalinadigan qisqa g'alaba ohangi.
export function playWinSound() {
  playCached(() => winPlayer, (p) => { winPlayer = p; }, WIN_SOUND);
}

// O'yinda yutqazganda chalinadigan o'ziga xos ohang.
export function playLoseSound() {
  playCached(() => losePlayer, (p) => { losePlayer = p; }, LOSE_SOUND);
}
