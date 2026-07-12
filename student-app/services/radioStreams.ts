// Haqiqiy jonli radio oqimlarini (stream) topish uchun — radio-browser.info
// ochiq, bepul, autentifikatsiyasiz jamoat radio-katalogi API'sidan foydalanadi.
// Bu yerda hech qanday stream URL qattiq yozilmagan (hardcode qilinmagan),
// chunki bunday havolalar tez-tez o'zgarib/uzilib turadi — o'rniga har safar
// stansiya nomi bo'yicha eng ishonchli (tekshirilgan, eng ko'p tinglangan)
// natija so'raladi va keshlanadi.
const RADIO_BROWSER_BASE = 'https://de1.api.radio-browser.info/json/stations/search';

type RadioBrowserStation = {
  url_resolved?: string;
  url?: string;
  lastcheckok?: number;
  clickcount?: number;
  votes?: number;
  hls?: number;
};

const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();

// HLS (.m3u8) oqimlar faqat Safari/iOS'da to'g'ridan-to'g'ri <audio> orqali
// ishlaydi — Chrome/Android/desktop web'da ishlamaydi. Shuning uchun
// to'g'ridan-to'g'ri (non-HLS, mp3/aac) oqimlarga ustunlik beriladi. HLS
// variantlar ro'yxat oxirida saqlanadi — pleer birinchi ishlamagan
// nomzoddan keyingisiga avtomatik o'tadi, shuning uchun ular butunlay
// tashlab yuborilmaydi (ba'zi platformalarda, masalan iOS'da, ishlaydi).
function streamScore(s: RadioBrowserStation): number {
  let score = 0;
  if (!s.hls) score += 100;
  if ((s.url_resolved || s.url || '').startsWith('https://')) score += 10;
  return score;
}

// Katalogdagi ko'p stansiyalar hali ham oddiy http:// manzil bilan qayd
// etilgan (garchi aslida https'ni ham qo'llab-quvvatlasa-da) — bizning sayt
// esa https-only (upgrade-insecure-requests + mixed-content bloklanadi),
// shuning uchun http:// manzilga to'g'ridan-to'g'ri <audio> orqali ulanib
// bo'lmaydi ("Media load rejected by URL safety check"). Shu sababli har bir
// http:// nomzod uchun avval xuddi shu host+yo'l bo'yicha https:// varianti
// sinab ko'riladi, asl http:// esa (kamdan-kam holatda kerak bo'lishi mumkin
// bo'lgani uchun) pastroq ustuvorlikdagi zaxira sifatida saqlanadi.
function withHttpsFallback(u: string): string[] {
  if (u.startsWith('http://')) return [u.replace(/^http:\/\//, 'https://'), u];
  return [u];
}

async function searchStreamUrls(query: string): Promise<string[]> {
  const url = `${RADIO_BROWSER_BASE}?name=${encodeURIComponent(query)}&limit=15&order=clickcount&reverse=true&hidebroken=true`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MyHomeworkApp/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list: RadioBrowserStation[] = await res.json();
  const candidates = list.filter((s) => s.lastcheckok === 1 && (s.url_resolved || s.url));
  candidates.sort((a, b) => streamScore(b) - streamScore(a));

  const seen = new Set<string>();
  const urls: string[] = [];
  outer: for (const c of candidates) {
    const raw = c.url_resolved || c.url;
    if (!raw) continue;
    for (const u of withHttpsFallback(raw)) {
      if (!seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
      if (urls.length >= 6) break outer;
    }
  }
  return urls;
}

// Berilgan qidiruv so'zi (odatda stansiya nomi) bo'yicha bir nechta haqiqiy
// jonli oqim nomzodini (eng ishonchlisidan boshlab) qaytaradi — pleer bittasi
// ishlamasa, keyingisini avtomatik sinab ko'radi. Topilmasa yoki tarmoq
// xatosi bo'lsa — bo'sh massiv.
export async function resolveStationStreamCandidates(query: string): Promise<string[]> {
  if (cache.has(query)) return cache.get(query)!;
  if (inflight.has(query)) return inflight.get(query)!;

  const promise = searchStreamUrls(query)
    .catch(() => [])
    .then((result) => {
      cache.set(query, result);
      inflight.delete(query);
      return result;
    });
  inflight.set(query, promise);
  return promise;
}
