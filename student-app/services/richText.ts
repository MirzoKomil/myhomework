/**
 * Admin (CRM) matnlaridagi oddiy belgilash sintaksisini tahlil qiluvchi —
 * React/RN'ga bog'liq emas, shuning uchun node'da ham sinab ko'rsa bo'ladi
 * (services/richText.test.mjs).
 *
 * Qoidalar CRM'dagi oldindan ko'rish (js/richText.js, formatRichText) bilan
 * AYNAN bir xil — admin nimani ko'rsa, o'quvchi ham shuni ko'rsin:
 *   - har bir qator alohida; "# " (# + bo'shliq) — sarlavha, "- " — ro'yxat
 *     bandi, bo'sh qator — oraliq;
 *   - qator ichida ketma-ket o'tishlar: avval {rang}…{/rang} (yopuvchi nom
 *     ochuvchi bilan bir xil bo'lishi shart, rang faqat bir qator ichida),
 *     keyin **qalin**, __tagiga chizilgan__, ==fon==, oxirida yakka *kursiv*;
 *     har biri eng qisqa (non-greedy) moslik bilan.
 * Juftligi topilmagan belgilar oddiy matn bo'lib qoladi — matn hech qachon
 * yo'qolmaydi va xato chiqmaydi (admin xato yozsa ham o'quvchi matnni ko'radi).
 */

export type RichColor = 'kok' | 'qizil' | 'yashil' | 'sariq';

// Ranglar — ilova dizayn palitrasidan (CRM'dagi tuslarga yaqin).
export const RICH_COLORS: Record<RichColor, string> = {
  kok: '#2F5BFF',
  qizil: '#D92D20',
  yashil: '#087A4A',
  sariq: '#B98500',
};
export const RICH_HIGHLIGHT = '#FFF1B8';

export type RichSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
  color?: RichColor;
};

export type RichBlock = { kind: 'p' | 'h' | 'li'; spans: RichSpan[] };

// CRM regex'lar bilan almashtiradi; biz HTML teglar o'rniga matnda uchramaydigan
// (Private Use) belgilarni qo'yamiz, keyin ularni bo'laklarga aylantiramiz.
// Shunday qilib keyingi o'tishlar (masalan ** rangli bo'lak ustidan) CRM'dagidek ishlaydi.
const P = 0xe000;
const COLOR_OPEN: Record<RichColor, string> = {
  kok: String.fromCharCode(P + 1),
  qizil: String.fromCharCode(P + 2),
  yashil: String.fromCharCode(P + 3),
  sariq: String.fromCharCode(P + 4),
};
const COLOR_CLOSE = String.fromCharCode(P + 5);
type Toggle = 'bold' | 'underline' | 'highlight' | 'italic';
const OPEN: Record<Toggle, string> = {
  bold: String.fromCharCode(P + 6),
  underline: String.fromCharCode(P + 8),
  highlight: String.fromCharCode(P + 10),
  italic: String.fromCharCode(P + 12),
};
const CLOSE: Record<Toggle, string> = {
  bold: String.fromCharCode(P + 7),
  underline: String.fromCharCode(P + 9),
  highlight: String.fromCharCode(P + 11),
  italic: String.fromCharCode(P + 13),
};
const MARKER_RE = /[-]/;

const colorKey = (name: string): RichColor => (name === 'koʻk' || name === 'kok' ? 'kok' : (name as RichColor));

/** CRM'dagi _rtInline o'tishlari — xuddi shu tartib va shu regex'lar. */
function markInline(line: string): string {
  let s = line;
  s = s.replace(/\{(koʻk|kok|qizil|yashil|sariq)\}([\s\S]*?)\{\/\1\}/g, (_, c: string, inner: string) => COLOR_OPEN[colorKey(c)] + inner + COLOR_CLOSE);
  s = s.replace(/\*\*(.+?)\*\*/g, (_, x: string) => OPEN.bold + x + CLOSE.bold);
  s = s.replace(/__(.+?)__/g, (_, x: string) => OPEN.underline + x + CLOSE.underline);
  s = s.replace(/==(.+?)==/g, (_, x: string) => OPEN.highlight + x + CLOSE.highlight);
  // Qalin (**) allaqachon almashtirilgan — bu yerda faqat yakka *.
  s = s.replace(/\*([^*]+?)\*/g, (_, x: string) => OPEN.italic + x + CLOSE.italic);
  return s;
}

function pushText(out: RichSpan[], text: string, fmt: Omit<RichSpan, 'text'>) {
  if (!text) return;
  const last = out[out.length - 1];
  // Bir xil formatdagi qo'shni bo'laklarni birlashtiramiz (kamroq <Text>).
  if (last && last.bold === fmt.bold && last.italic === fmt.italic && last.underline === fmt.underline && last.highlight === fmt.highlight && last.color === fmt.color) {
    last.text += text;
  } else out.push({ text, ...fmt });
}

export function parseInline(line: string): RichSpan[] {
  const out: RichSpan[] = [];
  const s = markInline(String(line ?? ''));
  if (!MARKER_RE.test(s)) return s ? [{ text: s }] : [];
  // Belgilar noto'g'ri ichma-ich bo'lishi mumkin (**a __b** c__) — brauzer
  // kabi har bir format alohida sanaladi, shuning uchun hech narsa yo'qolmaydi.
  const count: Record<Toggle, number> = { bold: 0, underline: 0, highlight: 0, italic: 0 };
  const colors: RichColor[] = [];
  let buf = '';
  const fmt = (): Omit<RichSpan, 'text'> => {
    const f: Omit<RichSpan, 'text'> = {};
    if (count.bold) f.bold = true;
    if (count.italic) f.italic = true;
    if (count.underline) f.underline = true;
    if (count.highlight) f.highlight = true;
    if (colors.length) f.color = colors[colors.length - 1];
    return f;
  };
  const flush = () => {
    pushText(out, buf, fmt());
    buf = '';
  };
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code < P + 1 || code > P + 13) {
      buf += ch;
      continue;
    }
    flush();
    if (code <= P + 4) colors.push((['kok', 'qizil', 'yashil', 'sariq'] as RichColor[])[code - P - 1]);
    else if (code === P + 5) colors.pop();
    else {
      const k = (['bold', 'underline', 'highlight', 'italic'] as Toggle[])[Math.floor((code - P - 6) / 2)];
      count[k] = Math.max(0, count[k] + ((code - P - 6) % 2 === 0 ? 1 : -1));
    }
  }
  flush();
  return out;
}

export function parseRichText(text: string): RichBlock[] {
  return String(text ?? '')
    .split(/\r\n?|\n/)
    .map((line) => {
      if (/^#\s+/.test(line)) return { kind: 'h' as const, spans: parseInline(line.replace(/^#\s+/, '')) };
      if (/^-\s+/.test(line)) return { kind: 'li' as const, spans: parseInline(line.replace(/^-\s+/, '')) };
      // Bo'sh (yoki faqat bo'shliqdan iborat) qator — oraliq.
      if (!line.trim()) return { kind: 'p' as const, spans: [] };
      return { kind: 'p' as const, spans: parseInline(line) };
    });
}

/** Matnda belgilash bo'lishi mumkinmi — yo'q bo'lsa matn avvalgidek ko'rsatiladi. */
export function hasRichText(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\*|__|==|\{(koʻk|kok|qizil|yashil|sariq)\}/.test(text) || /^(#|-)\s/m.test(text);
}

export const BULLET = '• ';

/** Belgilarsiz oddiy matn — sarlavha/qidiruv/TTS uchun (ro'yxat bandi "• " bilan). */
export function stripRichText(text: string | null | undefined): string {
  if (!text) return text ?? '';
  if (!hasRichText(text)) return text;
  return parseRichText(text)
    .map((b) => (b.kind === 'li' ? BULLET : '') + b.spans.map((x) => x.text).join(''))
    .join('\n');
}

/** TTS uchun: belgilar ham, ro'yxat nuqtasi ham olib tashlanadi. */
export function speakableText(text: string | null | undefined): string {
  if (!text) return text ?? '';
  if (!hasRichText(text)) return text;
  return parseRichText(text)
    .map((b) => b.spans.map((x) => x.text).join(''))
    .join('\n');
}
