import { useEffect, useState } from 'react';

import { getStudentProfile, StudentProfile } from '@/data/studentProfiles';
import { DemoPeerThread, fetchDemoPeerMessages, sendDemoPeerMessage } from '@/services/contentApi';

export type StudentChatMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
};

export type StudentChatThread = {
  id: string;
  name: string;
  avatarEmoji: string;
  messages: StudentChatMessage[];
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildThread(peerId: string, name: string, messages: StudentChatMessage[]): StudentChatThread {
  return { id: peerId, name, avatarEmoji: getStudentProfile(name).avatarEmoji, messages };
}

let threads: Record<string, StudentChatThread> = {};

// Foydalanuvchi hali xabar yozmagan, faqat profilni ochib "Muloqot
// qilish"ni bosgan suhbatlar — serverda hali umuman yo'q, shuning uchun
// keyingi serverdan yangilanishda ular yo'qolib qolmasligi uchun shu
// yerda ism bilan saqlanadi.
const pendingNames = new Map<string, string>();

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function rebuildThreads(data: Record<string, DemoPeerThread>) {
  const next: Record<string, StudentChatThread> = {};
  for (const [peerId, thread] of Object.entries(data)) {
    next[peerId] = buildThread(
      peerId,
      thread.peerName,
      thread.messages.map((m) => ({
        id: m.id,
        from: m.sender === 'student' ? 'me' : 'them',
        text: m.text ?? '',
        time: formatTime(m.time),
      }))
    );
    pendingNames.delete(peerId);
  }
  for (const [peerId, name] of pendingNames) {
    if (!next[peerId]) next[peerId] = buildThread(peerId, name, []);
  }
  threads = next;
}

let fetchPromise: Promise<void> | null = null;

// Ilova ochilganda bir marta yuklaydi, so'ng admin/hamkurs javob yozganini
// bilish uchun har 15 soniyada qayta so'raydi (push-notifikatsiya yo'q).
export function loadThreads(): Promise<void> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetchDemoPeerMessages()
    .then((data) => {
      rebuildThreads(data);
      notify();
    })
    .catch(() => {})
    .finally(() => {
      fetchPromise = null;
    });
  return fetchPromise;
}

loadThreads();
setInterval(loadThreads, 15000);

export function getThreads(): StudentChatThread[] {
  return Object.values(threads).sort((a, b) => b.messages.length - a.messages.length);
}

export function getThread(profileId: string): StudentChatThread | undefined {
  return threads[profileId];
}

export async function openThread(profile: StudentProfile): Promise<void> {
  if (!threads[profile.id]) {
    pendingNames.set(profile.id, profile.name);
    threads[profile.id] = buildThread(profile.id, profile.name, []);
    notify();
  }
}

export async function sendMessage(profile: StudentProfile, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const existing = threads[profile.id] ?? buildThread(profile.id, profile.name, []);
  // Darhol UI'da ko'rsatamiz (optimistic), so'ng serverga yuboramiz.
  threads[profile.id] = {
    ...existing,
    messages: [...existing.messages, { id: `local-${Date.now()}`, from: 'me', text: trimmed, time: formatTime(new Date().toISOString()) }],
  };
  notify();
  try {
    await sendDemoPeerMessage(profile.id, profile.name, trimmed);
    await loadThreads();
  } catch {
    // Tarmoq xatosi bo'lsa ham xabar mahalliy ko'rinishda qoladi.
  }
}

export function useStudentThreads(): StudentChatThread[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadThreads().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getThreads();
}

export function useStudentThread(profileId: string): StudentChatThread | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadThreads().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, [profileId]);
  return getThread(profileId);
}
