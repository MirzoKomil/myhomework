import { Linking, Platform } from 'react-native';

// iPhone Safari (va boshqa brauzerlar) tugma bosilgandan KEYIN — serverdan havola kelgach — ochilgan yangi oynani bloklaydi.
// Shuning uchun oynani bosish paytida darhol (bo'sh) ochamiz, havola kelgach unga yo'naltiramiz (13-noy: iPhone'da "Botni ochish" ishlamasdi).
export function openLater() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { go: (url: string) => Linking.openURL(url), cancel: () => {} };
  }
  let w: Window | null = null;
  try { w = window.open('', '_blank'); } catch { w = null; }
  return {
    go: async (url: string) => {
      if (w && !w.closed) { try { w.location.href = url; return; } catch { /* quyida */ } }
      window.location.href = url;
    },
    cancel: () => { try { w?.close(); } catch { /* yopilgan */ } },
  };
}
