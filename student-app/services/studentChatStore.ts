import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { StudentProfile } from '@/data/studentProfiles';

const THREADS_KEY = 'mh_student_chat_threads';

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

let threads: Record<string, StudentChatThread> = {};
let loaded = false;
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(THREADS_KEY)
      .then((raw) => {
        if (raw) threads = JSON.parse(raw);
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getThreads(): StudentChatThread[] {
  return Object.values(threads).sort((a, b) => b.messages.length - a.messages.length);
}

export function getThread(profileId: string): StudentChatThread | undefined {
  return threads[profileId];
}

export async function loadThreads(): Promise<void> {
  await ensureLoaded();
  notify();
}

async function ensureThread(profile: StudentProfile): Promise<StudentChatThread> {
  await ensureLoaded();
  if (!threads[profile.id]) {
    threads[profile.id] = { id: profile.id, name: profile.name, avatarEmoji: profile.avatarEmoji, messages: [] };
  }
  return threads[profile.id];
}

export async function openThread(profile: StudentProfile): Promise<void> {
  await ensureThread(profile);
  notify();
  await persist();
}

export async function sendMessage(profile: StudentProfile, text: string): Promise<void> {
  const thread = await ensureThread(profile);
  thread.messages.push({ id: `msg-${Date.now()}`, from: 'me', text, time: nowTime() });
  notify();
  await persist();
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
