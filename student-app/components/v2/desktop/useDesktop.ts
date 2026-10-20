/**
 * Kompyuter (keng ekran) rejimi.
 *
 * Kompyuter dizayni 1440×900 uchun chizilgan; 1024px dan keng web
 * oynada ilova shu dizaynga o'tadi. Telefon va planshet (tor oyna)
 * avvalgidek mobil ko'rinishda qoladi.
 */
import { useEffect, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_MIN_WIDTH = 1024;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}

/**
 * Kompyuterdagi klaviatura tugmalari (dizayndagi <kbd> yorliqlari).
 * `handlers` kaliti — KeyboardEvent.key ('Escape', 'ArrowLeft', ' ', 'Enter', '1' …).
 * Matn kiritish maydonida turganda (input/textarea) faqat Escape va Enter ishlaydi.
 */
export function useDesktopKeys(handlers: Record<string, (() => void) | undefined>, enabled = true) {
  // Har renderda yangi obyekt keladi — tinglovchini qayta ulamaslik uchun ref.
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (typing && key !== 'Escape' && key !== 'Enter') return;
      const h = ref.current;
      const fn = h[key] ?? h[key.toLowerCase()];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
