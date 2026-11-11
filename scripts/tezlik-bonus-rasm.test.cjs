// 11-noyabr (tezlik): bonus rasmlari holatda URL bo'lib boradi, saqlashda asl base64 qaytariladi.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../server/services/bonusImages');
const IMG = 'data:image/jpeg;base64,' + Buffer.from('salom-rasm').toString('base64');
const db = data => ({ query: async () => ({ rows: [{ data }] }) });

test('GET: base64 rasm URL bilan almashadi, boshqa maydonlar o‘zgarmaydi', () => {
    const out = B.toUrls({ macbook: { label: 'MacBook', image: IMG, amount: 5 }, umra: { label: 'Umra', image: '' } });
    assert.match(out.macbook.image, /^\/api\/state\/bonus-image\/macbook\?h=[0-9a-f]{12}$/);
    assert.equal(out.macbook.label, 'MacBook'); assert.equal(out.macbook.amount, 5);
    assert.equal(out.umra.image, '');
});

test('PATCH: URL qaytsa asl rasm tiklanadi; yangi yuklangan rasm va o‘chirish saqlanadi', async () => {
    const urls = B.toUrls({ macbook: { image: IMG }, iphone: { image: IMG } });
    const NEW = 'data:image/png;base64,' + Buffer.from('yangi').toString('base64');
    const out = await B.restore(db({ macbook: { image: IMG }, iphone: { image: IMG } }),
        { macbook: { ...urls.macbook, label: 'Mac' }, iphone: { image: NEW }, umra: { image: '' } });
    assert.equal(out.macbook.image, IMG); assert.equal(out.macbook.label, 'Mac');
    assert.equal(out.iphone.image, NEW);
    assert.equal(out.umra.image, '');
});

test('rasm endpointi: turini va baytlarini qaytaradi, SVG yuborilmaydi', async () => {
    const r = await B.read(db({ macbook: { image: IMG }, x: { image: 'data:image/svg+xml;base64,PHN2Zz4=' } }), 'macbook');
    assert.equal(r.type, 'image/jpeg'); assert.equal(r.buf.toString(), 'salom-rasm');
    assert.equal(await B.read(db({ x: { image: 'data:image/svg+xml;base64,PHN2Zz4=' } }), 'x'), null);
    assert.equal(B.toUrls({ x: { image: 'data:image/svg+xml;base64,PHN2Zz4=' } }).x.image.startsWith('data:'), true);
});
