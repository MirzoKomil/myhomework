/**
 * v2 ichidagi "orqaga" tarixi.
 *
 * v2 ekranlari eski ilova bilan bitta brauzer/router tarixida yashaydi.
 * router.canGoBack() eski ilova sahifalarini ham "orqa" deb hisoblaydi,
 * shuning uchun v2'dagi "‹" tugmasi o'quvchini eski ilovaga olib chiqib
 * ketardi. Bu yerda faqat shu sessiyada ochilgan v2 sahifalari yoziladi:
 * oldingi v2 sahifa bo'lsa — router.back(), bo'lmasa — fallback v2 ekrani.
 */
import { router, type Href } from 'expo-router';

const trail: string[] = [];
let replacing = false;
let tabbing = false;

/** V2Layout har bir pathname o'zgarishida chaqiradi. */
export function recordV2Path(path: string) {
  if (!path) return;
  if (tabbing) {
    // Pastki menyu bo'limi — yangi boshlanish nuqtasi.
    tabbing = false;
    trail.length = 0;
    trail.push(path);
    return;
  }
  if (replacing) {
    replacing = false;
    if (trail.length) trail[trail.length - 1] = path;
    else trail.push(path);
    return;
  }
  if (trail.length >= 2 && trail[trail.length - 2] === path) trail.pop();
  else if (trail[trail.length - 1] !== path) trail.push(path);
  if (trail.length > 100) trail.splice(0, trail.length - 100);
}

export function v2CanGoBack() {
  return trail.length >= 2;
}

/** Orqaga: oldingi v2 sahifa bo'lsa — unga, bo'lmasa fallback v2 ekraniga. */
export function v2Back(fallback: string) {
  if (v2CanGoBack() && router.canGoBack()) {
    router.back();
    return;
  }
  replacing = true;
  router.replace(fallback as Href);
}

/**
 * Pastki menyu (Asosiy/Darslar/Mashq/Liga/Profil) bo'limiga o'tish.
 *
 * Avval har bosishda router.push qilinardi: stekka yangi ekran qo'shilib
 * borardi (10 marta bosilsa — 10 ta ekran xotirada, har biri o'z taymeri va
 * so'rovlari bilan) va ilova sekinlashib qotardi. dismissTo — bo'lim stekda
 * bo'lsa unga qaytadi, bo'lmasa joriy ekranni almashtiradi: stek o'smaydi.
 */
export function v2Tab(href: string) {
  tabbing = true;
  router.dismissTo(href as Href);
}

/** Faqat testlar uchun. */
export function __resetV2Trail() {
  trail.length = 0;
  replacing = false;
  tabbing = false;
}
