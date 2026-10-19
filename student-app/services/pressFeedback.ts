/**
 * Web: barcha tugma va havolalar bosilganda yengil "botib" chiqadi (0.97).
 *
 * v2 ekranlaridagi Pressable'lar har xil joyda yozilgan — har biriga alohida
 * animatsiya qo'shish o'rniga bitta CSS qoidasi. Inline `transform`i bor
 * (animatsiyalangan) elementlarga ta'sir qilmaydi; "Reduce motion"da o'chadi.
 */
import { Platform } from 'react-native';

const ID = 'v2-press-feedback';
const CSS = `
@media (prefers-reduced-motion: no-preference) {
  [role="button"]:not([aria-disabled="true"]), [role="link"], [role="switch"], [role="tab"] {
    transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  [role="button"]:not([aria-disabled="true"]):active, [role="link"]:active, [role="switch"]:active, [role="tab"]:active {
    transform: scale(0.97);
    transition-duration: 70ms;
  }
}`;

export function installPressFeedback() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.getElementById(ID)) return;
  const el = document.createElement('style');
  el.id = ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
