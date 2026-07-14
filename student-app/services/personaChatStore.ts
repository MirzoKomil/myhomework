import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { celebrityPersonas, ChatMessage } from '@/data/mock';
import { addCoins, getTotalCoins } from '@/services/coinsStore';
import { sendDemoPersonaMessage } from '@/services/contentApi';

const MESSAGES_KEY = 'mh_persona_chat_messages';
const ACCESS_KEY = 'mh_persona_chat_access';

export const COIN_PER_MINUTE = 1;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribePersona(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function buildInitialMessages(): ChatMessage[] {
  return celebrityPersonas.map((p) => ({
    id: `intro-${p.id}`,
    chatId: p.id,
    from: 'them',
    type: 'text',
    text: p.intro,
    time: '',
  }));
}

let messages: ChatMessage[] = buildInitialMessages();
let access: Record<string, number> = {}; // personaId -> expiresAt (ms epoch)
let loaded = false;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = Promise.all([AsyncStorage.getItem(MESSAGES_KEY), AsyncStorage.getItem(ACCESS_KEY)])
      .then(([msgRaw, accessRaw]) => {
        if (msgRaw) {
          const stored: ChatMessage[] = JSON.parse(msgRaw);
          const storedChatIds = new Set(stored.map((m) => m.chatId));
          messages = [...buildInitialMessages().filter((m) => !storedChatIds.has(m.chatId)), ...stored];
        }
        if (accessRaw) access = JSON.parse(accessRaw);
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

async function persistMessages() {
  try {
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

async function persistAccess() {
  try {
    await AsyncStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

export async function loadPersonaChats(): Promise<void> {
  await ensureLoaded();
  notify();
}

export function getPersonaMessages(personaId: string): ChatMessage[] {
  return messages.filter((m) => m.chatId === personaId);
}

export function hasRealExchange(personaId: string): boolean {
  return messages.some((m) => m.chatId === personaId && !m.id.startsWith('intro-'));
}

// 140-ish: matn xabarlarini serverga ham ko'chiradi (fire-and-forget) — CRM
// "Afsonalar" bo'limida shu suhbatlarni kuzatishi uchun. Mahalliy xatti-
// harakat (AsyncStorage'ga saqlash, rasm/ovozli xabarlar) o'zgarishsiz
// qoladi — bu faqat ko'rish uchun qo'shimcha oyna, asosiy manba emas.
function syncPersonaMessageToServer(msg: ChatMessage) {
  if (msg.type !== 'text' || !msg.text) return;
  const persona = celebrityPersonas.find((p) => p.id === msg.chatId);
  sendDemoPersonaMessage(msg.chatId, persona?.name || msg.chatId, msg.text, msg.from === 'me' ? 'student' : 'persona').catch(() => {});
}

export async function addPersonaMessage(msg: ChatMessage) {
  await ensureLoaded();
  messages.push(msg);
  notify();
  syncPersonaMessageToServer(msg);
  await persistMessages();
}

// ─── Coin-billed access (har daqiqasi 1 coin) ───────────────────────────────

export function getAccessExpiresAt(personaId: string): number | null {
  return access[personaId] ?? null;
}

export function hasActiveAccess(personaId: string): boolean {
  const expiresAt = access[personaId];
  return expiresAt !== undefined && expiresAt > Date.now();
}

export async function purchaseMinutes(personaId: string, minutes: number): Promise<boolean> {
  await ensureLoaded();
  const cost = minutes * COIN_PER_MINUTE;
  if (getTotalCoins() < cost) return false;
  await addCoins(-cost);
  access[personaId] = Date.now() + minutes * 60000;
  notify();
  await persistAccess();
  return true;
}

export function useLegendAccess(personaId: string): { expiresAt: number | null; remainingSeconds: number; active: boolean } {
  const [, setTick] = useState(0);

  useEffect(() => {
    loadPersonaChats().then(() => setTick((t) => t + 1));
    return subscribePersona(() => setTick((t) => t + 1));
  }, [personaId]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const expiresAt = getAccessExpiresAt(personaId);
  const remainingSeconds = expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : 0;
  return { expiresAt, remainingSeconds, active: remainingSeconds > 0 };
}

const DEMO_REPLIES = [
  "That's a great question! (Demo javob — haqiqiy AI ulanishi keyinroq qo'shiladi.)",
  "Interesting thought! Keep practicing your English with me. (Demo javob.)",
  "I like how you put that — tell me more! (Demo javob.)",
];

export function pickDemoReply(): string {
  return DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];
}
