import { celebrityPersonas, ChatMessage } from '@/data/mock';

type Listener = () => void;

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
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function getPersonaMessages(personaId: string): ChatMessage[] {
  return messages.filter((m) => m.chatId === personaId);
}

export function addPersonaMessage(msg: ChatMessage) {
  messages.push(msg);
  notify();
}

export function subscribePersona(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const DEMO_REPLIES = [
  "That's a great question! (Demo javob — haqiqiy AI ulanishi keyinroq qo'shiladi.)",
  "Interesting thought! Keep practicing your English with me. (Demo javob.)",
  "I like how you put that — tell me more! (Demo javob.)",
];

export function pickDemoReply(): string {
  return DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];
}
