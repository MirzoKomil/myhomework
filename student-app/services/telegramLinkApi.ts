import { Platform } from 'react-native';
import { authedFetch } from './contentApi';
import { getToken, ready } from './studentAuthStore';

const base = (Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz')) + '/api/domwork/student-telegram';
export type TelegramLinkRequest = {
  id: string; state: 'pending' | 'claimed' | 'confirmed' | 'cancelled'; expired: boolean; expiresAt: string;
  telegram: { id: string; name: string; username: string } | null;
};
export type TelegramLinkStatus = { linked: boolean; available: boolean; mandatory?: boolean; request: TelegramLinkRequest | null };
async function request<T>(path: string, body?: object): Promise<T> {
  await ready();
  if (!getToken()) throw Error('O‘quvchi akkauntingiz bilan tizimga kiring.');
  const response = await authedFetch(base + path, { cache: 'no-store', signal: AbortSignal.timeout(15000),
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Telegram ulanishida xatolik');
  return data as T;
}
export const telegramLinkStatus = () => request<TelegramLinkStatus>('');
export type TelegramLinkCreated = { request: TelegramLinkRequest; url: string; qr?: { size: number; path: string } };
export const createTelegramLink = () => request<TelegramLinkCreated>('', {});
export const confirmTelegramLink = (r: TelegramLinkRequest) => request<{ ok: boolean }>('/confirm', { requestId: r.id, telegramId: r.telegram?.id });
export const cancelTelegramLink = (r: TelegramLinkRequest) => request<{ ok: boolean }>('/cancel', { requestId: r.id });
