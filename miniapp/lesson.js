'use strict';
// 1-dars mazmuni (UX hujjati: claude/miniapp_1dars_ux.md). Matnni o'zgartirish — faqat shu fayl.
// Urg'u belgisi — U+0301 (а́). Serverda solishtirishda urg'u olib tashlanadi.
(function () {
  // Soha → ish joyi (o'rin-payt kelishigi -е). Bo'sh yoki boshqa soha — ofis.
  const WORK = {
    bank: { ru: 'в ба́нке', lat: 'v banke', uz: 'bankda', base: 'банк', wrong: 'в банк', hr: 'bankdagi vakansiya' },
    med: { ru: 'в больни́це', lat: "v bol'nitse", uz: 'kasalxonada', base: 'больни́ца', wrong: 'в больни́ца', hr: 'klinikadagi vakansiya' },
    sales: { ru: 'в магази́не', lat: 'v magazine', uz: 'doʻkonda', base: 'магази́н', wrong: 'в магази́н', hr: 'doʻkondagi vakansiya' },
    office: { ru: 'в о́фисе', lat: 'v ofise', uz: 'ofisda', base: 'о́фис', wrong: 'в о́фис', hr: 'ofisdagi vakansiya' }
  };
  const work = field => WORK[field] || WORK.office;

  // O'zbekcha lotin ismi → kirill (ism ruscha gapda chiroyli ko'rinishi uchun). Baholashda ism hisobga olinmaydi.
  function cyr(name) {
    let s = String(name || '').trim().split(/\s+/)[0] || '';
    if (/[а-яё]/i.test(s)) return s;
    s = s.toLowerCase().replace(/[ʻʼ'`’‘]/g, "'");
    const pairs = [["o'", 'у'], ["g'", 'г'], ['sh', 'ш'], ['ch', 'ч'], ['ya', 'я'], ['yu', 'ю'], ['yo', 'ё'], ['ye', 'е'], ['ts', 'ц'], ['ng', 'нг']];
    const single = { a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', w: 'в', c: 'к' };
    let out = '';
    for (let i = 0; i < s.length;) {
      const p = pairs.find(([l]) => s.startsWith(l, i));
      if (p) { out += p[1]; i += p[0].length; continue; }
      const ch = s[i];
      out += i === 0 && ch === 'e' ? 'э' : (single[ch] ?? (ch === "'" ? '' : ch));
      i++;
    }
    return out ? out[0].toUpperCase() + out.slice(1) : '';
  }

  // Yosh: 16–80. Rus tilida son + год/го́да/лет; lotincha o'qilishi.
  const ONES = ['', 'оди́н', 'два', 'три', 'четы́ре', 'пять', 'шесть', 'семь', 'во́семь', 'де́вять'];
  const ONES_L = ['', 'odin', 'dva', 'tri', 'chetyre', "pyat'", "shest'", "sem'", "vosem'", "devyat'"];
  const TEENS = { 16: ['шестна́дцать', "shestnadtsat'"], 17: ['семна́дцать', "semnadtsat'"], 18: ['восемна́дцать', "vosemnadtsat'"], 19: ['девятна́дцать', "devyatnadtsat'"] };
  const TENS = { 2: ['два́дцать', "dvadtsat'"], 3: ['три́дцать', "tridtsat'"], 4: ['со́рок', 'sorok'], 5: ['пятьдеся́т', "pyat'desyat"], 6: ['шестьдеся́т', "shest'desyat"], 7: ['се́мьдесят', "sem'desyat"], 8: ['во́семьдесят', "vosem'desyat"] };
  function years(n) {
    const t = n % 100, o = n % 10;
    if (t >= 11 && t <= 14) return ['лет', 'let'];
    if (o === 1) return ['год', 'god'];
    if (o >= 2 && o <= 4) return ['го́да', 'goda'];
    return ['лет', 'let'];
  }
  function age(n) {
    n = Math.max(16, Math.min(80, Math.round(Number(n) || 30)));
    const [ru, lat] = n < 20 ? TEENS[n] : [[TENS[Math.floor(n / 10)][0], ONES[n % 10]].filter(Boolean).join(' '), [TENS[Math.floor(n / 10)][1], ONES_L[n % 10]].filter(Boolean).join(' ')];
    const [y, yl] = years(n);
    return { n, ru: `Мне ${n} ${y}.`, words: ru, lat: `Mne ${lat} ${yl}.`, uz: `Men ${n} yoshdaman.` };
  }

  // 3 gap — "O'zingiz gapiring" (ism, yosh, ish joyi).
  function phrases(name, ageN, field) {
    const w = work(field), a = age(ageN), nm = cyr(name) || 'Анва́р';
    const latName = String(name || 'Anvar').split(/\s+/)[0];
    return [
      { ru: `Меня́ зову́т ${nm}.`, lat: `Menya zovut ${latName}.`, uz: `Mening ismim ${latName}.` },
      { ru: a.ru, lat: a.lat, uz: a.uz },
      { ru: `Я рабо́таю ${w.ru}.`, lat: `Ya rabotayu ${w.lat}.`, uz: `Men ${w.uz} ishlayman.` }
    ];
  }

  // Video konspekti (4 ibora).
  const KONSPEKT = [
    { ru: 'Как вас зову́т? — Меня́ зову́т Тиму́р.', uz: 'Ismingiz nima? — Mening ismim Timur. (вас — «sizni», hurmat bilan)' },
    { ru: 'Ско́лько вам лет? — Мне три́дцать пять лет.', uz: '«Я 35 лет» emas — Мне («menga»). 21 год · 22–24 го́да · 25–30 лет' },
    { ru: 'Где вы рабо́таете? — Я рабо́таю в ба́нке.', uz: 'банк → в ба́нке (≈ -da): в о́фисе, в магази́не, в больни́це' },
    { ru: 'Я врач. Я бухга́лтер. Я води́тель.', uz: 'Men shifokorman / buxgalterman / haydovchiman — «-man» shart emas' }
  ];
  const VOCAB = [['Здра́вствуйте!', 'Assalomu alaykum!'], ['да · нет', 'ha · yoʻq'], ['клие́нт', 'mijoz'], ['ка́сса', 'kassa'], ['бухга́лтер', 'buxgalter'], ['спаси́бо', 'rahmat'], ['в о́фисе', 'ofisda'], ['в ба́нке', 'bankda']];

  // Uy vazifasi — 5 mashq. kind: pick (variant), gap (bo'sh joy), build (gap tuzish).
  function homework(field) {
    const w = work(field);
    // Qisqa: 3 mashq (≈1 daqiqa) — videodagi uchta gapning har biriga bittadan.
    return [
      { kind: 'pick', title: 'Tarjimasini tanlang', prompt: { ru: 'Меня́ зову́т Тиму́р.' }, ruOptions: false,
        options: ['Mening ismim Timur.', 'Men Timurni chaqiraman.', 'Timur meni chaqiradi.'], answer: 0,
        ok: ['Barakalla!', '«Меня́ зову́т» — soʻzma-soʻz «meni chaqirishadi», maʼnosi «mening ismim».'],
        bad: ['Hech qisi yoʻq!', '«Меня́ зову́т Тиму́р» — «Mening ismim Timur». Rus tilida ism shunday aytiladi.'] },
      { kind: 'gap', title: 'Gapni toʻldiring', before: '', after: ' 35 лет.', uz: 'Men 35 yoshdaman.',
        options: ['Я', 'Мне', 'Меня́'], answer: 1,
        ok: ['Barakalla!', 'Yosh — <b lang="ru">Мне</b> bilan: soʻzma-soʻz «menga 35 yil».'],
        bad: ['Hech qisi yoʻq!', 'Yosh har doim <b lang="ru">Мне</b> bilan aytiladi: <span lang="ru">Мне 35 лет</span>.'], topic: 'Мне 35 лет', skill: 'yoshni aytish' },
      { kind: 'gap', title: 'Gapni toʻldiring', before: 'Я рабо́таю ', after: '.', uz: `Men ${w.uz} ishlayman.`,
        options: [w.ru, w.wrong, 'на ' + w.base], answer: 0,
        ok: ['Zoʻr!', `«Qayerda?» → <b lang="ru">-е</b>: <span lang="ru">${w.ru}</span>.`],
        bad: ['Deyarli!', `Toʻgʻrisi — <span lang="ru">${w.ru}</span>. «Qayerda?» savolida oxiri <b lang="ru">-е</b>.`], topic: w.ru, skill: 'oʻrin-payt kelishigi' }
    ];
  }

  // O'yin 1 — ish suhbati (4 savol, 25 s). Oxirgisi ovoz bilan.
  function dialog(name, ageN, field) {
    const w = work(field), a = age(ageN), nm = cyr(name) || 'Анва́р';
    return {
      hr: w.hr,
      questions: [
        { q: 'Здра́вствуйте! Как вас зову́т?', uz: 'Assalomu alaykum! Ismingiz nima?', options: [`Меня́ зову́т ${nm}.`, `Мне зову́т ${nm}.`, `Я зову́т ${nm}.`], answer: 0,
          why: 'Ism — <span lang="ru">Меня́ зову́т…</span>' },
        { q: 'Ско́лько вам лет?', uz: 'Yoshingiz nechada?', options: [a.ru, `Я ${a.n} ${a.ru.split(' ').slice(2).join(' ').replace('.', '')}.`, `Меня́ ${a.n} ${a.ru.split(' ').slice(2).join(' ').replace('.', '')}.`], answer: 0,
          why: 'Yosh — <span lang="ru">Мне…</span>' },
        { q: 'Где вы рабо́таете?', uz: 'Qayerda ishlaysiz?', options: [`Я рабо́таю ${w.ru}.`, `Я рабо́таю ${w.wrong}.`, `Мне рабо́таю ${w.ru.replace('в ', '')}.`], answer: 0,
          near: 1, why: `«Qayerda?» → <span lang="ru">${w.ru}</span> (-е). Videoda koʻrgan qoidangiz.` },
        { q: `Вы рабо́таете ${w.ru}?`, uz: `${w.uz[0].toUpperCase() + w.uz.slice(1)} ishlaysizmi?`, voice: { ru: `Да, я рабо́таю ${w.ru}.`, lat: `Da, ya rabotayu ${w.lat}.` },
          options: [`Да, я рабо́таю ${w.ru}.`, `Да, я рабо́таю ${w.wrong}.`, `Да, мне рабо́таю ${w.ru}.`], answer: 0, why: `Javob: <span lang="ru">Да, я рабо́таю ${w.ru}.</span>` }
      ]
    };
  }

  // O'yin 2 — juftlar (6 juftlik, 60 s). audio: true — karta faqat ovoz (tinglab topiladi).
  const PAIRS = [
    { ru: 'клие́нт', uz: 'mijoz' }, { ru: 'ка́сса', uz: 'kassa' }, { ru: 'спаси́бо', uz: 'rahmat' },
    { ru: 'в ба́нке', uz: 'bankda' }, { ru: 'бухга́лтер', uz: 'buxgalter', audio: true }, { ru: 'в о́фисе', uz: 'ofisda' }
  ];

  // Kursdagi yopiq darslar (Dars yo'lida ko'rsatiladi).
  const TEASERS = [
    { n: 30, title: 'Doʻkon va bozor' },
    { n: 36, title: 'Kasb va ish', ru: 'Кем вы рабо́таете?', result: 'oʻz ishingiz haqida gaplasha olasiz',
      items: ['Ustoz bilan jonli dars', 'Ish suhbati dialogi va rolli oʻyin', '8 ta yangi soʻz, oʻyin va mashqlar'] },
    { n: 61, title: 'Telefonda rasmiy nutq' }
  ];

  // Ustoz namunasi audiolari: /miniapp/audio/<kalit>.mp3 bo'lsa — shu, bo'lmasa brauzer ovozi (ru-RU).
  const AUDIO = {};

  window.LESSON = { WORK, work, cyr, age, phrases, KONSPEKT, VOCAB, homework, dialog, PAIRS, TEASERS, AUDIO };
})();
