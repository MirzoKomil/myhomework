import { ChatMessage, initialChatMessages } from '@/data/mock';
import { DemoMessage, DemoMessageThreadId, fetchDemoMessages, sendDemoMessage } from '@/services/contentApi';

type Listener = () => void;

// "Qo'llab-quvvatlash"/"Asosiy ustoz"/"Yordamchi ustoz" — CRM'ning "Namuna
// o'quvchi" bilan bog'liq haqiqiy, serverda saqlanadigan suhbatlar. Boshqa
// barcha "Ma'muriyat" bo'limi threadlari (masalan "Loyiha rahbari")
// avvalgidek faqat mahalliy/soxta bo'lib qoladi.
const REAL_THREAD_IDS: DemoMessageThreadId[] = ['support', 'main-teacher', 'assistant-teacher'];

function isRealThread(chatId: string): chatId is DemoMessageThreadId {
  return (REAL_THREAD_IDS as string[]).includes(chatId);
}

function toChatMessage(chatId: DemoMessageThreadId, m: DemoMessage): ChatMessage {
  return {
    id: m.id,
    chatId,
    from: m.sender === 'student' ? 'me' : 'them',
    type: 'text',
    text: m.text,
    time: m.time,
  };
}

let localMessages: ChatMessage[] = initialChatMessages.filter((m) => !isRealThread(m.chatId));

let realMessages: Record<DemoMessageThreadId, ChatMessage[]> = {
  support: [],
  'main-teacher': [],
  'assistant-teacher': [],
};

const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}

let fetchPromise: Promise<void> | null = null;

export function refreshRealMessages(): Promise<void> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetchDemoMessages()
    .then((data) => {
      realMessages = {
        support: data.support.map((m) => toChatMessage('support', m)),
        'main-teacher': data.mainTeacher.map((m) => toChatMessage('main-teacher', m)),
        'assistant-teacher': data.assistantTeacher.map((m) => toChatMessage('assistant-teacher', m)),
      };
      notify();
    })
    .catch(() => {})
    .finally(() => {
      fetchPromise = null;
    });
  return fetchPromise;
}

// Ilova ochilganda bir marta yuklaydi, so'ng ustoz/admin javob yozganini
// bilish uchun har 15 soniyada qayta so'raydi (push-notifikatsiya yo'q).
refreshRealMessages();
setInterval(refreshRealMessages, 15000);

export function getMessages(chatId: string): ChatMessage[] {
  if (isRealThread(chatId)) return realMessages[chatId];
  return localMessages.filter((m) => m.chatId === chatId);
}

export function getLastMessage(chatId: string): ChatMessage | undefined {
  const list = getMessages(chatId);
  return list[list.length - 1];
}

export function addMessage(msg: ChatMessage) {
  if (isRealThread(msg.chatId)) {
    // Darhol UI'da ko'rsatamiz (optimistic), so'ng serverga yuboramiz —
    // muvaffaqiyatli bo'lsa haqiqiy ro'yxat bilan qayta sinxronlaymiz.
    realMessages[msg.chatId] = [...realMessages[msg.chatId], msg];
    notify();
    if (msg.type === 'text' && msg.text) {
      sendDemoMessage(msg.chatId, msg.text)
        .then(() => refreshRealMessages())
        .catch(() => {});
    }
    return;
  }
  localMessages.push(msg);
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
