/**
 * Kompyuter qobig'i (yon menyu va yuqori panel) uchun umumiy ma'lumot.
 *
 * Bir xil qiymatlar har ekranda ko'rinadi (coin, seriya, chaqmoq, daraja,
 * liga o'rni, o'qilmagan bildirishnomalar, ism, avatar). Ekran almashganda
 * "0" miltillamasligi uchun oxirgi qiymat modulda saqlanadi va fonda
 * yangilanadi. Manbalar — mobil ekranlar ishlatadigan funksiyalarning o'zi.
 */
import { useEffect, useState } from 'react';

import { getReadIds } from '@/components/v2/home/shared';
import { fetchDemoNotifications, fetchDemoStudentProfile, fetchLeaderboard } from '@/services/contentApi';
import { fetchMyProgress } from '@/services/progressSync';
import { getStudent } from '@/services/studentAuthStore';

export type ShellInfo = {
  /** Ismning birinchi so'zi ("Samandar"); noma'lum bo'lsa ''. */
  firstName: string;
  streak: number;
  /** Haftalik liga o'rni; ro'yxatda bo'lmasa null. */
  leagueRank: number | null;
  unread: number;
};

let info: ShellInfo = { firstName: '', streak: 0, leagueRank: null, unread: 0 };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let lastRefresh = 0;

function set(patch: Partial<ShellInfo>) {
  info = { ...info, ...patch };
  listeners.forEach((l) => l());
}

/** Fonda yangilash (bir vaqtda bittadan; 5 soniyadan tez-tez emas, majburiy bo'lmasa). */
export function refreshShell(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - lastRefresh < 5000) return Promise.resolve();
  lastRefresh = Date.now();
  const s = getStudent();
  if (!info.firstName && s?.name) set({ firstName: s.name.split(' ')[0] });
  inflight = Promise.allSettled([
    fetchDemoStudentProfile().then((p) => {
      if (p?.name) set({ firstName: p.name.split(' ')[0] });
    }),
    fetchMyProgress().then((p) => {
      if (p) set({ streak: p.streak });
    }),
    fetchLeaderboard('country', 'weekly').then((list) => {
      set({ leagueRank: list.find((e) => e.isMe)?.rank ?? null });
    }),
    Promise.all([fetchDemoNotifications(), getReadIds()]).then(([list, read]) => {
      set({ unread: list.filter((n) => n.unread && !read.has(n.id)).length });
    }),
  ]).then(() => {
    inflight = null;
  });
  return inflight;
}

/** Bildirishnomalar o'qilganda ekran chaqiradi — nishon darrov yo'qolsin. */
export function setShellUnread(n: number) {
  set({ unread: Math.max(0, n) });
}

export function useShellInfo(): ShellInfo {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    void refreshShell();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return info;
}
