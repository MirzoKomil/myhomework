#!/usr/bin/env node
/**
 * Web export'dan keyin: v2 sahifalarining HTML <head>'iga yangi ilova
 * manifestini, nomini va ikonkasini yozib qo'yadi.
 *
 * Sabab: iPhone Safari "Bosh ekranga qo'shish" paytida server yuborgan
 * HTML'dagi teglarni o'qiydi — JS bilan keyin almashtirilganini emas.
 * Shu sabab /student/v2 dan qo'shilgan ikonka eski ilovani (/student/)
 * ochardi. Ishlatish: node scripts/postexport-v2-head.js [dist]
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const root = path.join(dist, 'v2');

const REPLACE = [
  [/<link rel="manifest" href="[^"]*"\/?>/, '<link rel="manifest" href="/student/manifest-russian-v2.webmanifest"/>'],
  [/<meta name="apple-mobile-web-app-title" content="[^"]*"\/?>/, '<meta name="apple-mobile-web-app-title" content="Domwork"/>'],
  [/<link rel="apple-touch-icon" href="[^"]*"\/?>/, '<link rel="apple-touch-icon" href="/student/domik-icon-180.png"/>'],
  [/<link rel="icon" href="[^"]*" ?\/?>/, '<link rel="icon" type="image/png" sizes="32x32" href="/student/domik-icon-32.png"/>'],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (!fs.existsSync(root)) {
  console.error('v2 papkasi topilmadi:', root);
  process.exit(1);
}
let n = 0;
for (const file of walk(root)) {
  let html = fs.readFileSync(file, 'utf8');
  for (const [re, to] of REPLACE) {
    if (!re.test(html)) {
      console.error('Teg topilmadi:', re, 'faylda', file);
      process.exit(1);
    }
    html = html.replace(re, to);
  }
  fs.writeFileSync(file, html);
  n++;
}
console.log(`v2 head yangilandi: ${n} ta HTML`);
