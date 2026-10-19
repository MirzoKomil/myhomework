/**
 * Admin (CRM) matnlaridagi oddiy belgilash sintaksisini tahlil qiluvchi —
 * React/RN'ga bog'liq emas, shuning uchun node'da ham sinab ko'rsa bo'ladi
 * (services/richText.test.mjs).
 *
 * Qoidalar (har bir qator alohida tahlil qilinadi):
 *   **qalin**  *kursiv*  __tagiga chizilgan__  ==sariq fon==
 *   {koʻk}…{/koʻk} {qizil}…{/qizil} {yashil}…{/yashil} {sariq}…{/sariq}
 *   "# " bilan boshlangan qator — sarlavha, "- " bilan — ro'yxat bandi.
 * Juftligi topilmagan belgilar oddiy matn bo'lib qoladi — matn hech qachon
 * yo'qolmaydi va xato chiqmaydi (admin xato yozsa ham o'quvchi matnni ko'radi).
 */

export type RichColor = 'kok' | 'qizil' | 'yashil' | 'sariq';

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

type Fmt = Omit<RichSpan, 'text'>;

// "koʻk" turli apostroflar bilan yoziladi (ʻ ' ‘ ’ `) yoki umuman apostrofsiz.
const COLOR_TAG = /^\{(\/?)(ko[ʻ'‘’`]?k|qizil|yashil|sariq)\}/i;

function colorKey(name: string): RichColor {
  const n = name.toLowerCase();
  return n.startsWith('ko') ? 'kok' : (n as RichColor);
}

type Toggle = { mark: string; key: 'bold' | 'italic' | 'underline' | 'highlight' };
// Uzunroq belgi avval tekshiriladi ("**" "*" dan oldin).
const TOGGLES: Toggle[] = [
  { mark: '**', key: 'bold' },
  { mark: '__', key: 'underline' },
  { mark: '==', key: 'highlight' },
  { mark: '*', key: 'italic' },
];

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/** s[i]'dagi belgi aynan shu uzunlikdagi qatormi — "___" (bo'sh joy) yoki "===" chiziq belgi emas. */
function exactRun(s: string, i: number, mark: string): boolean {
  if (!s.startsWith(mark, i)) return false;
  const ch = mark[0];
  return s[i - 1] !== ch && s[i + mark.length] !== ch;
}

/** Yopuvchi belgini qidiradi: undan oldin bo'shliq bo'lmasligi kerak ("2 * 3" kursiv emas). */
function findClose(s: string, from: number, mark: string): number {
  for (let j = from; j < s.length; j++) {
    if (exactRun(s, j, mark) && !isSpace(s[j - 1]) && j > from) return j;
  }
  return -1;
}

/** {rang} uchun mos {/rang}ni topadi (bir xil rang ichma-ich bo'lsa ham). */
function findColorClose(s: string, from: number, key: RichColor): { at: number; len: number } | null {
  let depth = 0;
  for (let j = from; j < s.length; j++) {
    if (s[j] !== '{') continue;
    const m = COLOR_TAG.exec(s.slice(j));
    if (!m || colorKey(m[2]) !== key) continue;
    if (m[1]) {
      if (depth === 0) return { at: j, len: m[0].length };
      depth--;
    } else depth++;
  }
  return null;
}

function pushText(out: RichSpan[], text: string, fmt: Fmt) {
  if (!text) return;
  const last = out[out.length - 1];
  // Bir xil formatdagi qo'shni bo'laklarni birlashtiramiz (kamroq <Text>).
  if (last && last.bold === fmt.bold && last.italic === fmt.italic && last.underline === fmt.underline && last.highlight === fmt.highlight && last.color === fmt.color) {
    last.text += text;
  } else out.push({ text, ...fmt });
}

function parseInlineInto(s: string, fmt: Fmt, out: RichSpan[], depth: number) {
  let buf = '';
  let i = 0;
  const flush = () => {
    pushText(out, buf, fmt);
    buf = '';
  };
  while (i < s.length) {
    const c = s[i];
    // Juda chuqur ichma-ichlik — himoya: qolganini oddiy matn sifatida.
    if (depth < 12 && (c === '*' || c === '_' || c === '=')) {
      const t = TOGGLES.find((x) => exactRun(s, i, x.mark));
      if (t && !fmt[t.key] && !isSpace(s[i + t.mark.length])) {
        const close = findClose(s, i + t.mark.length, t.mark);
        if (close > 0) {
          flush();
          parseInlineInto(s.slice(i + t.mark.length, close), { ...fmt, [t.key]: true }, out, depth + 1);
          i = close + t.mark.length;
          continue;
        }
      }
    } else if (depth < 12 && c === '{') {
      const m = COLOR_TAG.exec(s.slice(i));
      if (m && !m[1]) {
        const key = colorKey(m[2]);
        const close = findColorClose(s, i + m[0].length, key);
        if (close && close.at > i + m[0].length) {
          flush();
          parseInlineInto(s.slice(i + m[0].length, close.at), { ...fmt, color: key }, out, depth + 1);
          i = close.at + close.len;
          continue;
        }
      }
    }
    buf += c;
    i++;
  }
  flush();
}

export function parseInline(s: string): RichSpan[] {
  const out: RichSpan[] = [];
  parseInlineInto(s, {}, out, 0);
  return out;
}

export function parseRichText(text: string): RichBlock[] {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => {
      const h = /^\s*# (.*)$/.exec(line);
      if (h) return { kind: 'h' as const, spans: parseInline(h[1]) };
      const li = /^\s*- (.*)$/.exec(line);
      if (li) return { kind: 'li' as const, spans: parseInline(li[1]) };
      return { kind: 'p' as const, spans: parseInline(line) };
    });
}

/** Matnda belgilash bo'lishi mumkinmi — yo'q bo'lsa matn avvalgidek ko'rsatiladi. */
export function hasRichText(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\*|__|==|\{\/?(ko|qizil|yashil|sariq)/i.test(text) || /^\s*(# |- )/m.test(text);
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
