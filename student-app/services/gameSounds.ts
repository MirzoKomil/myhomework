import { createAudioPlayer } from 'expo-audio';

const WIN_SOUND = require('@/assets/sounds/win.wav');
const LOSE_SOUND = require('@/assets/sounds/lose.wav');

function playSound(source: number) {
  try {
    const player = createAudioPlayer(source);
    const listener = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        listener.remove();
        player.remove();
      }
    });
    player.play();
  } catch {
    // Ovoz ijro etilmasa ham o'yin natijasiga ta'sir qilmasin.
  }
}

// O'yinda yutganda chalinadigan qisqa g'alaba ohangi.
export function playWinSound() {
  playSound(WIN_SOUND);
}

// O'yinda yutqazganda chalinadigan o'ziga xos ohang.
export function playLoseSound() {
  playSound(LOSE_SOUND);
}
