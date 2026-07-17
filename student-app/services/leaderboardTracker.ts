import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 142-ish qayta ish 8: "Reytingda 10 pog'ona ko'tarilganda" bildirishnomasi —
// reyting butunlay qurilmada (mock ro'yxat + haqiqiy tanga/chaqmoq) hisoblanadi,
// server bu o'zgarishni bilmaydi. Shu sabab oldingi bilingan o'rin shu yerda
// saqlanadi va yangi hisoblangan o'rin bilan solishtiriladi — faqat asosiy
// ko'rinish (alltime/country, ekran ochilganda standart tanlanadigan) uchun,
// aks holda foydalanuvchi filtr almashtirganda soxta signal chiqadi.
const LAST_RANK_KEY = 'mh_last_leaderboard_rank';
const CLIMB_THRESHOLD = 10;

const CLIMB_API_BASE =
  Platform.OS === 'web'
    ? '/api/state/notifications/leaderboard-climb'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/notifications/leaderboard-climb';

export async function checkLeaderboardClimb(currentRank: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_RANK_KEY);
    const prevRank = raw !== null ? Number(raw) : null;
    if (prevRank !== null && prevRank - currentRank >= CLIMB_THRESHOLD) {
      fetch(CLIMB_API_BASE, { method: 'POST' }).catch(() => {
        // Tarmoq xatoligi bo'lsa jim o'tkazib yuboramiz.
      });
    }
    if (prevRank === null || currentRank !== prevRank) {
      await AsyncStorage.setItem(LAST_RANK_KEY, String(currentRank));
    }
  } catch {
    // AsyncStorage o'qib/yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}
