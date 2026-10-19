/**
 * Faol qurilmalar — serverdagi mavjud `/api/auth/sessions` (o'quvchi
 * login qilganda createSession yozadi). Yangi endpoint yo'q: CRM ham
 * aynan shu ro'yxatni ishlatadi (js/api.js).
 */
import { Platform } from 'react-native';

import { authedFetch } from '@/services/contentApi';
import { getToken, ready } from '@/services/studentAuthStore';

const SESSIONS_API =
  (Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz')) + '/api/auth/sessions';

export type DeviceSession = {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastSeen: string;
  isCurrent: boolean;
};

export async function fetchSessions(): Promise<DeviceSession[]> {
  await ready();
  if (!getToken()) return [];
  const r = await authedFetch(SESSIONS_API, { cache: 'no-store' });
  if (!r.ok) return [];
  const data = await r.json().catch(() => ({}));
  const list: DeviceSession[] = Array.isArray(data?.sessions) ? data.sessions : [];
  // Joriy qurilma doim birinchi, qolganlari oxirgi faollik bo'yicha.
  return [...list].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });
}

export type ParsedDevice = {
  /** Qurilma nomi: "Windows · Chrome", "Android 14" ... */
  name: string;
  /** Ikkinchi qator: "Android 14 · Domwork ilovasi" yoki "Veb-sayt · myhomework.uz" */
  kind: string;
  mobile: boolean;
};

function osOf(ua: string): string {
  const android = ua.match(/Android\s([\d.]+)/i);
  if (android) return `Android ${android[1].split('.')[0]}`;
  const ios = ua.match(/(?:iPhone|iPad|iPod).*?OS\s([\d_]+)/i);
  if (ios) return `iOS ${ios[1].split('_')[0]}`;
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Nomaʼlum qurilma';
}

function browserOf(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/YaBrowser/i.test(ua)) return 'Yandex';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return '';
}

export function parseUserAgent(ua: string): ParsedDevice {
  const os = osOf(ua || '');
  const mobile = /Android|iPhone|iPad|iPod|Mobile|okhttp|Darwin|CFNetwork|Expo/i.test(ua || '');
  // Native ilova so'rovlari brauzer nomisiz keladi (okhttp/CFNetwork/Expo).
  const isApp = /okhttp|CFNetwork|Darwin|Expo|Dalvik/i.test(ua || '') && !/Mozilla/i.test(ua || '');
  if (isApp) return { name: os, kind: `${os} · Domwork ilovasi`, mobile: true };
  const browser = browserOf(ua || '');
  const osShort = os.replace(/\s[\d]+$/, '');
  return {
    name: browser ? `${osShort} · ${browser}` : osShort,
    kind: 'Veb-sayt · myhomework.uz',
    mobile,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2 kun oldin faol edi · 15.10" (bugun bo'lsa — soat bilan). */
export function lastSeenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return `Bugun faol edi · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${days} kun oldin faol edi · ${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

/** Oxirgi kirishlar: "Bugun · 08:12" yoki "15.10 · 21:40". */
export function loginTimeLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? `Bugun · ${time}` : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} · ${time}`;
}
