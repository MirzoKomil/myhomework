import { ChatMessage, initialChatMessages } from '@/data/mock';

type Listener = () => void;

let messages: ChatMessage[] = [...initialChatMessages];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function getMessages(chatId: string): ChatMessage[] {
  return messages.filter((m) => m.chatId === chatId);
}

export function getLastMessage(chatId: string): ChatMessage | undefined {
  const list = getMessages(chatId);
  return list[list.length - 1];
}

export function addMessage(msg: ChatMessage) {
  messages.push(msg);
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
