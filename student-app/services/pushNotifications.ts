import { Platform } from 'react-native';

// 142-ish qayta ish 8: haqiqiy Web Push — ilova butunlay yopiq/fon rejimida
// bo'lsa ham, brauzer/qurilma darajasida bildirishnoma keladi (avvalgi
// "Bildirishnomalar" faqat ilova ochilganda ko'rinadigan ro'yxat edi).
// Hozircha faqat web (PWA) uchun — native build hali yo'q.

const API_BASE =
  Platform.OS === 'web'
    ? '/api/state/push'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/push';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Joriy qurilmada allaqachon faol obuna bor-yo'qligini tekshiradi (masalan
// ilova qayta ochilganda tugma holatini to'g'ri ko'rsatish uchun).
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/student/');
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

export async function enablePushNotifications(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: "Brauzeringiz push-bildirishnomalarni qo'llab-quvvatlamaydi" };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, error: 'Ruxsat berilmadi' };

    const registration = await navigator.serviceWorker.register('/student/sw.js');
    await navigator.serviceWorker.ready;

    const keyRes = await fetch(`${API_BASE}/vapid-public-key`);
    const { publicKey } = await keyRes.json();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Xatolik' };
  }
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/student/');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch(`${API_BASE}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch {
    // Bekor qilishda xato bo'lsa jim o'tkazib yuboramiz.
  }
}
