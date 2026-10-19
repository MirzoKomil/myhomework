// Rich-text parser testi. Ishga tushirish (test freymvorksiz):
//   node --experimental-strip-types services/richText.test.mjs
import assert from 'node:assert/strict';
import { hasRichText, parseInline, parseRichText, speakableText, stripRichText } from './richText.ts';

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log('ok', n, '-', name);
};
const plain = (spans) => spans.map((s) => s.text).join('');

t('oddiy matn o\'zgarmaydi', () => {
  const s = 'Здравствуйте! Как дела?\nYaxshi.';
  assert.equal(hasRichText(s), false);
  assert.equal(stripRichText(s), s);
  assert.deepEqual(parseInline('Привет'), [{ text: 'Привет' }]);
});
t('qalin / kursiv / tagiga chizish / fon', () => {
  assert.deepEqual(parseInline('a **b** c'), [{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }]);
  assert.deepEqual(parseInline('*k*'), [{ text: 'k', italic: true }]);
  assert.deepEqual(parseInline('__u__'), [{ text: 'u', underline: true }]);
  assert.deepEqual(parseInline('==h=='), [{ text: 'h', highlight: true }]);
});
t('ichma-ich: **qalin *kursiv* qalin**', () => {
  assert.deepEqual(parseInline('**a *b* c**'), [
    { text: 'a ', bold: true },
    { text: 'b', bold: true, italic: true },
    { text: ' c', bold: true },
  ]);
  assert.deepEqual(parseInline('*a **b** c*'), [
    { text: 'a ', italic: true },
    { text: 'b', italic: true, bold: true },
    { text: ' c', italic: true },
  ]);
});
t('ranglar: koʻk / kok, yopuvchi nom bir xil bo\'lishi shart', () => {
  assert.deepEqual(parseInline('{koʻk}x{/koʻk}'), [{ text: 'x', color: 'kok' }]);
  assert.deepEqual(parseInline('{kok}x{/kok}'), [{ text: 'x', color: 'kok' }]);
  assert.deepEqual(parseInline('{kok}x{/koʻk}'), [{ text: '{kok}x{/koʻk}' }]);
  assert.deepEqual(parseInline('{qizil}**x**{/qizil} y'), [{ text: 'x', color: 'qizil', bold: true }, { text: ' y' }]);
  assert.equal(plain(parseInline('{sariq}s{/sariq}')), 's');
  assert.deepEqual(parseInline('{yashil}{/yashil}a'), [{ text: 'a' }]);
});
t('o\'tishlar tartibi CRM bilan bir xil: rang, **, __, ==, *', () => {
  // ** rangli bo'lak ustidan ham ishlaydi (rang avval almashtiriladi).
  assert.deepEqual(parseInline('**a {qizil}b{/qizil} c**'), [
    { text: 'a ', bold: true },
    { text: 'b', bold: true, color: 'qizil' },
    { text: ' c', bold: true },
  ]);
  // Noto'g'ri ichma-ichlik ham matnni yo'qotmaydi.
  assert.equal(plain(parseInline('**a __b** c__')), 'a b c');
  assert.deepEqual(parseInline('**a *b* c**'), [
    { text: 'a ', bold: true },
    { text: 'b', bold: true, italic: true },
    { text: ' c', bold: true },
  ]);
  // CRM regex'idagidek: yakka * juftlari kursiv bo'ladi, bitta "___" esa o'zgarmaydi.
  assert.deepEqual(parseInline('Я ___ студент'), [{ text: 'Я ___ студент' }]);
  assert.deepEqual(parseInline('2 * 3 * 4'), [{ text: '2 ' }, { text: ' 3 ', italic: true }, { text: ' 4' }]);
});
t('juftsiz belgilar — oddiy matn, hech narsa yo\'qolmaydi', () => {
  for (const s of ['**ochiq', 'yopiq**', '*a', '{qizil}yopilmagan', 'x{/qizil}', '{kok}a{/qizil}', '__a', '==a', '{}', '****', '{Qizil}a{/Qizil}']) {
    assert.equal(plain(parseInline(s)), s, s);
  }
});
t('sarlavha, ro\'yxat va bo\'sh qator (oraliq)', () => {
  const b = parseRichText('# Mavzu\n- birinchi **x**\noddiy\n\n#teg\n   \n-yo\'q');
  assert.deepEqual(b.map((x) => x.kind), ['h', 'li', 'p', 'p', 'p', 'p', 'p']);
  assert.equal(plain(b[0].spans), 'Mavzu');
  assert.equal(plain(b[1].spans), 'birinchi x');
  assert.deepEqual(b[3].spans, []);
  assert.equal(plain(b[4].spans), '#teg');
  assert.deepEqual(b[5].spans, []);
  assert.equal(plain(b[6].spans), "-yo'q");
});
t('stripRichText / speakableText', () => {
  const s = '# Salom\n- **Привет** — {koʻk}salom{/koʻk}\n==Можно меню?==';
  assert.equal(stripRichText(s), 'Salom\n• Привет — salom\nМожно меню?');
  assert.equal(speakableText(s), 'Salom\nПривет — salom\nМожно меню?');
  assert.equal(stripRichText(''), '');
  assert.equal(stripRichText(undefined), '');
});
t('buzuq kirish xato chiqarmaydi', () => {
  const junk = '**{qizil}*__==}{/{/sariq}# - **'.repeat(50);
  const r = parseRichText(junk);
  assert.equal(r.map((b) => plain(b.spans)).join(''), plain(parseInline(junk)));
  const deep = '*'.repeat(500) + 'x' + '*'.repeat(500);
  assert.ok(plain(parseInline(deep)).includes('x'));
});
console.log(`\n${n} ta test o'tdi`);
