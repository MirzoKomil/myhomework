// Myhomework.uz — mobil ilovadagi dars kontenti generatsiya qiluvchi mantiqning
// 1:1 porti (student-app/data/lessonContent.ts asosida). Faqat CRM'dagi dars
// tahrirlash formalarini "hozirgi appda chiqib turgan" kontent bilan oldindan
// to'ldirish (pre-fill) uchun ishlatiladi — o'zgarmas ma'lumot, saqlab
// bo'lmaydi/o'zgartirilmaydi.

function ldHashId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
}

function ldPickWindow(pool, offset, count) {
    return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
}

// ─── Vocabulary pool ────────────────────────────────────────────────────────
const LD_VOCAB_POOL = [
    { id: 'v1', icon: 'restaurant-outline', english: 'apple', translation: 'olma', transcript: '/ˈæp.əl/' },
    { id: 'v2', icon: 'walk-outline', english: 'window', translation: 'deraza', transcript: '/ˈwɪn.doʊ/' },
    { id: 'v3', icon: 'people-outline', english: 'friend', translation: "do'st", transcript: '/frend/' },
    { id: 'v4', icon: 'happy-outline', english: 'happy', translation: 'baxtli', transcript: '/ˈhæp.i/' },
    { id: 'v5', icon: 'airplane-outline', english: 'travel', translation: 'sayohat qilmoq', transcript: '/ˈtræv.əl/' },
    { id: 'v6', icon: 'flame-outline', english: 'kitchen', translation: 'oshxona', transcript: '/ˈkɪtʃ.ɪn/' },
    { id: 'v7', icon: 'partly-sunny-outline', english: 'weather', translation: 'ob-havo', transcript: '/ˈweð.ər/' },
    { id: 'v8', icon: 'school-outline', english: 'teacher', translation: "o'qituvchi", transcript: '/ˈtiː.tʃər/' },
    { id: 'v9', icon: 'flash-outline', english: 'quick', translation: 'tez', transcript: '/kwɪk/' },
    { id: 'v10', icon: 'library-outline', english: 'library', translation: 'kutubxona', transcript: '/ˈlaɪ.brer.i/' },
    { id: 'v11', icon: 'star-outline', english: 'important', translation: 'muhim', transcript: '/ɪmˈpɔːr.tənt/' },
    { id: 'v12', icon: 'sunny-outline', english: 'morning', translation: 'ertalab', transcript: '/ˈmɔːr.nɪŋ/' },
    { id: 'v13', icon: 'water-outline', english: 'river', translation: "daryo", transcript: '/ˈrɪv.ər/' },
    { id: 'v14', icon: 'car-outline', english: 'journey', translation: 'sayohat', transcript: '/ˈdʒɜːr.ni/' },
    { id: 'v15', icon: 'bed-outline', english: 'bedroom', translation: 'yotoqxona', transcript: '/ˈbed.ruːm/' },
    { id: 'v16', icon: 'basket-outline', english: 'market', translation: 'bozor', transcript: '/ˈmɑːr.kɪt/' },
    { id: 'v17', icon: 'heart-outline', english: 'health', translation: 'salomatlik', transcript: '/helθ/' },
    { id: 'v18', icon: 'book-outline', english: 'story', translation: 'hikoya', transcript: '/ˈstɔːr.i/' },
    { id: 'v19', icon: 'time-outline', english: 'schedule', translation: 'jadval', transcript: '/ˈskedʒ.uːl/' },
    { id: 'v20', icon: 'briefcase-outline', english: 'job', translation: 'ish', transcript: '/dʒɑːb/' },
    { id: 'v21', icon: 'thunderstorm-outline', english: 'storm', translation: "bo'ron", transcript: '/stɔːrm/' },
    { id: 'v22', icon: 'leaf-outline', english: 'nature', translation: 'tabiat', transcript: '/ˈneɪ.tʃər/' },
    { id: 'v23', icon: 'gift-outline', english: 'present', translation: "sovg'a", transcript: '/ˈprez.ənt/' },
    { id: 'v24', icon: 'musical-notes-outline', english: 'song', translation: "qo'shiq", transcript: '/sɔːŋ/' },
    { id: 'v25', icon: 'wallet-outline', english: 'money', translation: 'pul', transcript: '/ˈmʌn.i/' },
    { id: 'v26', icon: 'medkit-outline', english: 'doctor', translation: 'shifokor', transcript: '/ˈdɑːk.tər/' },
    { id: 'v27', icon: 'football-outline', english: 'sport', translation: 'sport', transcript: '/spɔːrt/' },
    { id: 'v28', icon: 'moon-outline', english: 'night', translation: 'kecha', transcript: '/naɪt/' },
    { id: 'v29', icon: 'paw-outline', english: 'animal', translation: 'hayvon', transcript: '/ˈæn.ə.məl/' },
    { id: 'v30', icon: 'shirt-outline', english: 'clothes', translation: 'kiyim', transcript: '/kloʊðz/' },
    { id: 'v31', icon: 'phone-portrait-outline', english: 'phone', translation: 'telefon', transcript: '/foʊn/' },
    { id: 'v32', icon: 'cloud-outline', english: 'cloud', translation: 'bulut', transcript: '/klaʊd/' },
    { id: 'v33', icon: 'restaurant-outline', english: 'dinner', translation: 'kechki ovqat', transcript: '/ˈdɪn.ər/' },
    { id: 'v34', icon: 'bus-outline', english: 'transport', translation: 'transport', transcript: '/ˈtræns.pɔːrt/' },
    { id: 'v35', icon: 'globe-outline', english: 'country', translation: 'mamlakat', transcript: '/ˈkʌn.tri/' },
    { id: 'v36', icon: 'construct-outline', english: 'build', translation: 'qurmoq', transcript: '/bɪld/' },
    { id: 'v37', icon: 'trending-up-outline', english: 'improve', translation: 'yaxshilamoq', transcript: '/ɪmˈpruːv/' },
    { id: 'v38', icon: 'hand-left-outline', english: 'strong', translation: 'kuchli', transcript: '/strɔːŋ/' },
    { id: 'v39', icon: 'chatbubbles-outline', english: 'conversation', translation: 'suhbat', transcript: '/ˌkɑːn.vərˈseɪ.ʃən/' },
    { id: 'v40', icon: 'bulb-outline', english: 'idea', translation: "g'oya", transcript: '/aɪˈdiːə/' },
];

// ─── Rus tili kursi, 1-dars uchun lug'at (admin CRM orqali kiritgan) ────────
const LD_RU_LESSON1_VOCAB = [
    { id: 'ru1-1', icon: 'hand-right-outline', english: 'Здравствуйте!', translation: 'Assalomu alaykum! (rasmiy salomlashish)', transcript: '' },
    { id: 'ru1-2', icon: 'chatbubble-outline', english: 'Привет!', translation: "Salom! (do'stona salomlashish)", transcript: '' },
    { id: 'ru1-3', icon: 'sunny-outline', english: 'Добрый день!', translation: 'Xayrli kun!', transcript: '' },
    { id: 'ru1-4', icon: 'help-circle-outline', english: 'Как вас зовут?', translation: 'Ismingiz nima? (rasmiy)', transcript: '' },
    { id: 'ru1-5', icon: 'help-circle-outline', english: 'Как тебя зовут?', translation: "Isming nima? (do'stona)", transcript: '' },
    { id: 'ru1-6', icon: 'person-outline', english: 'Меня зовут...', translation: 'Mening ismim...', transcript: '' },
    { id: 'ru1-7', icon: 'happy-outline', english: 'Очень приятно!', translation: 'Juda mamnunman! (tanishganda)', transcript: '' },
    { id: 'ru1-8', icon: 'calendar-outline', english: 'Сколько вам лет?', translation: 'Yoshingiz nechida? (rasmiy)', transcript: '' },
    { id: 'ru1-9', icon: 'calendar-outline', english: 'Сколько тебе лет?', translation: "Yoshing nechida? (do'stona)", transcript: '' },
    { id: 'ru1-10', icon: 'person-circle-outline', english: 'Мне ... лет / год / года', translation: 'Men ... yoshdaman.', transcript: '' },
    { id: 'ru1-11', icon: 'time-outline', english: 'Год', translation: 'Yil / Yosh (1, 21, 31 yosh uchun)', transcript: '' },
    { id: 'ru1-12', icon: 'time-outline', english: 'Года', translation: 'Yil / Yosh (2-4, 22-24, 32-34 yosh uchun)', transcript: '' },
    { id: 'ru1-13', icon: 'time-outline', english: 'Лет', translation: 'Yil / Yosh (5-20, 25-30 yosh va hokazo)', transcript: '' },
    { id: 'ru1-14', icon: 'exit-outline', english: 'До свидания!', translation: "Xayr! / Ko'rishguncha (rasmiy)", transcript: '' },
    { id: 'ru1-15', icon: 'hand-left-outline', english: 'Пока!', translation: "Xayr! (do'stona)", transcript: '' },
    { id: 'ru1-16', icon: 'today-outline', english: 'Сегодня', translation: 'Bugun', transcript: '[sivodnya]' },
    { id: 'ru1-17', icon: 'person-outline', english: 'Его', translation: 'Uni / Uniki', transcript: '[evo]' },
    { id: 'ru1-18', icon: 'home-outline', english: 'Дом', translation: 'Uy', transcript: '' },
    { id: 'ru1-19', icon: 'cafe-outline', english: 'Молоко', translation: 'Süt', transcript: '[malako]' },
    { id: 'ru1-20', icon: 'school-outline', english: 'Школа', translation: 'Maktab', transcript: '' },
    { id: 'ru1-21', icon: 'add-circle-outline', english: 'Ещё', translation: 'Yana / Hali', transcript: '[yeshchyo]' },
    { id: 'ru1-22', icon: 'close-circle-outline', english: 'Нет', translation: "Yo'q", transcript: '' },
];

// ─── Grammar fill-in-gap pool ───────────────────────────────────────────────
const LD_GRAMMAR_POOL = [
    { id: 'g1', sentence: 'She ___ to school every day.', answer: 'goes', options: ['go', 'goes', 'going', 'gone'] },
    { id: 'g2', sentence: 'They ___ football on Sundays.', answer: 'play', options: ['play', 'plays', 'playing', 'played'] },
    { id: 'g3', sentence: 'He ___ watching TV right now.', answer: 'is', options: ['is', 'are', 'am', 'be'] },
    { id: 'g4', sentence: 'I ___ my homework yesterday.', answer: 'did', options: ['do', 'does', 'did', 'done'] },
    { id: 'g5', sentence: 'We ___ never been to Paris.', answer: 'have', options: ['have', 'has', 'had', 'having'] },
    { id: 'g6', sentence: 'My sister ___ coffee in the morning.', answer: 'drinks', options: ['drink', 'drinks', 'drinking', 'drank'] },
    { id: 'g7', sentence: 'Look! It ___ raining outside.', answer: 'is', options: ['is', 'was', 'are', 'be'] },
    { id: 'g8', sentence: 'She ___ a new car last month.', answer: 'bought', options: ['buy', 'buys', 'bought', 'buying'] },
    { id: 'g9', sentence: 'Can you ___ me with this bag?', answer: 'help', options: ['help', 'helps', 'helping', 'helped'] },
    { id: 'g10', sentence: 'They ___ studying for the exam right now.', answer: 'are', options: ['is', 'am', 'are', 'be'] },
    { id: 'g11', sentence: 'We ___ dinner at 7 pm usually.', answer: 'have', options: ['have', 'has', 'having', 'had'] },
    { id: 'g12', sentence: 'He ___ to the gym twice a week.', answer: 'goes', options: ['go', 'goes', 'going', 'went'] },
];

// ─── Rus tili kursi, 1-dars uchun Video Quiz (admin CRM orqali kiritgan) ────
const LD_RU_LESSON1_GRAMMAR = [
    {
        id: 'ru1-q1',
        sentence: '"О" harfiga urg\'u tushganda va tushmaganda qanday o\'qiladi?',
        answer: "Urg'u tushsa [O], urg'usiz bo'lsa [A]",
        options: ['Har doim [O] deb', "Urg'u tushsa [O], urg'usiz bo'lsa [A]", 'Har doim [A] deb'],
    },
    {
        id: 'ru1-q2',
        sentence: '"Сегодня" so\'zidagi "го" birikmasi qanday talaffuz qilinadi?',
        answer: '[сиводня]',
        options: ['[сегодня]', '[сиводня]', '[сеходня]'],
    },
    {
        id: 'ru1-q3',
        sentence: "Yoshingizni aytayotganda 1 yosh uchun qaysi so'z ishlatiladi? (masalan: Мне 21 ...)",
        answer: 'Год',
        options: ['Год', 'Года', 'Лет'],
    },
];

// ─── Rus tili kursi, 1-dars uchun Uyga vazifa (admin CRM orqali kiritgan) ───
const LD_RU_LESSON1_HOMEWORK = [
    {
        id: 'A',
        kind: 'multipleChoice',
        title: 'A-QISM — Talaffuz va fonetika',
        questions: [
            { id: 'ru1h-a1', question: '"Красивого" so\'zining to\'g\'ri talaffuzi qaysi?', options: ['[красивого]', '[красивово]'], correctIndex: 1 },
            { id: 'ru1h-a2', question: '"Молоко" so\'zining to\'g\'ri talaffuzi qaysi?', options: ['[молоко]', '[малако]'], correctIndex: 1 },
            { id: 'ru1h-a3', question: '"Ещё" so\'zining to\'g\'ri talaffuzi qaysi?', options: ['[ешо]', '[ещё]', '[yeshchyo]'], correctIndex: 2 },
            { id: 'ru1h-a4', question: '"Его" so\'zining to\'g\'ri talaffuzi qaysi?', options: ['[его]', '[ево]'], correctIndex: 1 },
        ],
    },
    {
        id: 'B',
        kind: 'fillBlank',
        title: "B-QISM — Bo'sh o'rinlarni to'ldirish (yosh)",
        blanks: [
            { id: 'ru1h-b1', sentence: 'Мне 25 ___.', answer: 'лет', options: ['год', 'года', 'лет'] },
            { id: 'ru1h-b2', sentence: 'Мне 21 ___.', answer: 'год', options: ['год', 'года', 'лет'] },
            { id: 'ru1h-b3', sentence: 'Мне 33 ___.', answer: 'года', options: ['год', 'года', 'лет'] },
            { id: 'ru1h-b4', sentence: 'Мне 40 ___.', answer: 'лет', options: ['год', 'года', 'лет'] },
        ],
    },
    {
        id: 'C',
        kind: 'fillBlank',
        title: "C-QISM — Dialog to'ldirish",
        blanks: [
            { id: 'ru1h-c1', sentence: 'A: ___! Как вас зовут? B: Меня зовут Алишер.', answer: 'Здравствуйте', options: ['Здравствуйте', 'Пока', 'Спасибо'] },
            { id: 'ru1h-c2', sentence: 'A: Очень приятно, Алишер. Сколько вам лет? B: Мне 28 ___.', answer: 'лет', options: ['год', 'года', 'лет'] },
        ],
    },
    {
        id: 'D',
        kind: 'matching',
        title: "D-QISM — Tarjima va juftlikni topish",
        pairs: [
            { id: 'ru1h-d1', left: 'Как тебя зовут?', right: 'Isming nima?' },
            { id: 'ru1h-d2', left: 'Добрый день!', right: 'Xayrli kun!' },
            { id: 'ru1h-d3', left: 'Очень приятно!', right: 'Juda mamnunman!' },
            { id: 'ru1h-d4', left: 'Сегодня', right: 'Bugun' },
        ],
    },
    {
        id: 'creative',
        kind: 'creative',
        title: 'Ijodiy vazifa — Audio (nutq mashqi)',
        instruction:
            "Ovozli xabar (Audio) tugmasini bosing va o'zingiz haqingizda rus tilida 3-4 ta gapdan iborat tanishtiruv audio xabarini yozib qoldiring. Namuna: \"Здравствуйте! Меня зовут [Ismingiz]. Мне [Yoshingiz] лет/года/год. Очень приятно!\"",
        mediaType: 'audio',
    },
];

// ─── Rus tili kursi, 2-dars uchun Uyga vazifa (speaking turi, admin CRM orqali kiritgan) ───
const LD_RU_LESSON2_HOMEWORK = [
    {
        id: 'A',
        kind: 'record',
        title: 'PART A — Record yourself',
        prompts: [
            { id: 'ru2h-a1', sentence: 'Здравствуйте! Меня зовут [Имя], я из Узбекистана.', translation: "Assalomu alaykum! Mening ismim [Ism], men O'zbekistondanman." },
            { id: 'ru2h-a2', sentence: 'Я живу в Ташкенте и учусь в университете.', translation: "Men Toshkentda yashayman va universitetda o'qiyman." },
            { id: 'ru2h-a3', sentence: 'Я изучаю русский язык для работы и общения.', translation: "Men rus tilini ish va muloqot uchun o'rganyapman." },
        ],
    },
    {
        id: 'B',
        kind: 'roleplay',
        title: 'PART B — AI bilan suhbat / roleplay',
        scenario: {
            id: 'ru2h-b',
            title: 'Первое знакомство (Birinchi tanishuv)',
            intro: "Siz yangi muloqotdoshingiz bilan ko'rishib qoldingiz. U bilan salomlashing, ismingiz, yashash joyingiz, kasbingiz va rus tilini o'rganish maqsadingiz haqida suhbatlashing.",
            lines: [
                'Здравствуйте! Как вас зовут?',
                'Очень приятно! Откуда вы и где сейчас живёте?',
                'Чем вы занимаетесь: работаете или учитесь?',
                'Почему вы решили изучать русский язык?',
            ],
            closing: 'Отлично! Был очень рад с вами познакомиться. Желаю успехов в учёбе!',
        },
    },
    {
        id: 'C',
        kind: 'pronunciation',
        title: 'PART C — Pronunciation check',
        prompts: [
            { id: 'ru2h-c1', sentence: 'Здравствуйте! Очень приятно с вами познакомиться.', translation: 'Assalomu alaykum! Siz bilan tanishganimdan juda xursandman.' },
            { id: 'ru2h-c2', sentence: 'Извините, повторите, пожалуйста, немного медленнее.', translation: 'Kechirasiz, iltimos, biroz sekinroq takrorlang.' },
            { id: 'ru2h-c3', sentence: 'Моё любимое хобби — читать книги и заниматься спортом.', translation: "Mening sevimli hobbim — kitob o'qish va sport bilan shug'ullanish." },
            { id: 'ru2h-c4', sentence: 'Я свободно понимаю простые вопросы по-русски.', translation: 'Men rus tilida oddiy savollarni erkin tushunaman.' },
        ],
    },
    {
        id: 'creative',
        kind: 'creative',
        title: 'Ijodiy vazifa — Рассказ о себе (audio)',
        instruction:
            "Quyidagi tayyor qolipdan (shablon) foydalanib, o'zingiz haqingizdagi ma'lumotlar bilan to'ldiring va 30–60 soniyali audio xabar shaklida yozib yuboring:\n\nЗдравствуйте! Меня зовут [Ismingiz].\nЯ из [Viloyatingiz/Shahringiz], сейчас живу в [Hozirgi shahringiz].\nМне [Yoshingiz] лет.\nЯ работаю [Kasbingiz] / учусь в [O'quv joyingiz].\nМоё хобби — [Hobbiyingiz, masalan: спорт / книги / музыка].\nЯ изучаю русский язык, потому что [Sababi, masalan: он нужен для работы].",
        mediaType: 'audio',
    },
];

// ─── Matching pairs pool (english / uzbek) ─────────────────────────────────
const LD_MATCH_POOL = LD_VOCAB_POOL.slice(0, 20).map((w) => ({ id: w.id, left: w.english, right: w.translation }));

// ─── Multiple choice pool ───────────────────────────────────────────────────
const LD_MC_POOL = [
    { id: 'mc1', question: "'Kutubxona' so'zining inglizchasi qaysi?", options: ['Library', 'Market', 'Kitchen', 'Journey'], correctIndex: 0 },
    { id: 'mc2', question: "Qaysi so'z 'tez' degan ma'noni bildiradi?", options: ['Slow', 'Quick', 'Heavy', 'Light'], correctIndex: 1 },
    { id: 'mc3', question: "'She ___ a teacher.' bo'sh joyga mos keladigan so'z?", options: ['am', 'is', 'are', 'be'], correctIndex: 1 },
    { id: 'mc4', question: "'Ob-havo' so'zining inglizchasi qaysi?", options: ['Weather', 'Nature', 'Storm', 'Cloud'], correctIndex: 0 },
    { id: 'mc5', question: "Qaysi gap to'g'ri?", options: ['He go to school.', 'He goes to school.', 'He going to school.', 'He gone to school.'], correctIndex: 1 },
    { id: 'mc6', question: "'Muhim' so'zining inglizchasi qaysi?", options: ['Important', 'Improve', 'Idea', 'Income'], correctIndex: 0 },
    { id: 'mc7', question: "'They ___ football.' bo'sh joyga mos keladigan so'z?", options: ['plays', 'play', 'playing', 'played'], correctIndex: 1 },
    { id: 'mc8', question: "'Sog'liq' so'zining inglizchasi qaysi?", options: ['Health', 'Heart', 'Habit', 'Heavy'], correctIndex: 0 },
    { id: 'mc9', question: "Qaysi so'z 'kuchli' degan ma'noni bildiradi?", options: ['Weak', 'Strong', 'Soft', 'Slow'], correctIndex: 1 },
    { id: 'mc10', question: "'We ___ dinner at 7.' bo'sh joyga mos keladigan so'z?", options: ['has', 'have', 'having', 'had'], correctIndex: 1 },
];

// ─── Sentence building pool ─────────────────────────────────────────────────
const LD_SENTENCE_POOL = [
    { id: 's1', translation: 'U har kuni maktabga boradi.', words: ['school', 'to', 'goes', 'she', 'every', 'day'], answer: ['she', 'goes', 'to', 'school', 'every', 'day'] },
    { id: 's2', translation: "Ular yakshanba kunlari futbol o'ynashadi.", words: ['football', 'play', 'they', 'Sundays', 'on'], answer: ['they', 'play', 'football', 'on', 'Sundays'] },
    { id: 's3', translation: 'Men kecha uy vazifamni bajardim.', words: ['homework', 'did', 'my', 'yesterday', 'I'], answer: ['I', 'did', 'my', 'homework', 'yesterday'] },
    { id: 's4', translation: "U hozir televizor ko'rmoqda.", words: ['watching', 'is', 'TV', 'he', 'now'], answer: ['he', 'is', 'watching', 'TV', 'now'] },
    { id: 's5', translation: 'Bu juda muhim savol.', words: ['question', 'is', 'this', 'important', 'very'], answer: ['this', 'is', 'very', 'important', 'question'] },
    { id: 's6', translation: 'Biz kutubxonaga bormoqchimiz.', words: ['library', 'go', 'to', 'want', 'the', 'we', 'to'], answer: ['we', 'want', 'to', 'go', 'to', 'the', 'library'] },
    { id: 's7', translation: 'Onam ertalab qahva ichadi.', words: ['coffee', 'morning', 'drinks', 'my', 'mother', 'in', 'the'], answer: ['my', 'mother', 'drinks', 'coffee', 'in', 'the', 'morning'] },
    { id: 's8', translation: 'Bu hikoya juda qiziqarli.', words: ['interesting', 'very', 'story', 'this', 'is'], answer: ['this', 'story', 'is', 'very', 'interesting'] },
];

// ─── Speaking prompts pool ──────────────────────────────────────────────────
const LD_SPEAKING_POOL = [
    { id: 'sp1', sentence: 'Could you tell me more about yourself?', translation: "O'zingiz haqingizda ko'proq gapirib bera olasizmi?" },
    { id: 'sp2', sentence: 'What do you usually do on weekends?', translation: 'Odatda dam olish kunlari nima qilasiz?' },
    { id: 'sp3', sentence: 'I would like to practice my pronunciation.', translation: 'Men talaffuzimni mashq qilmoqchiman.' },
    { id: 'sp4', sentence: 'How was your day today?', translation: "Bugungi kuningiz qanday o'tdi?" },
    { id: 'sp5', sentence: 'This lesson is very useful for me.', translation: 'Bu dars men uchun juda foydali.' },
    { id: 'sp6', sentence: 'Can you help me with this exercise?', translation: 'Ushbu mashqda menga yordam bera olasizmi?' },
    { id: 'sp7', sentence: 'I enjoy learning new languages.', translation: "Men yangi tillarni o'rganishni yoqtiraman." },
    { id: 'sp8', sentence: "Let's talk about our future plans.", translation: 'Kelajakdagi rejalarimiz haqida gaplashaylik.' },
];

// ─── Roleplay scenarios ──────────────────────────────────────────────────────
const LD_ROLEPLAY_SCENARIOS = [
    {
        id: 'shop',
        title: "Do'konda",
        intro: "Siz do'konga kirdingiz. Sotuvchi bilan ingliz tilida suhbatlashing.",
        lines: [
            'Hello! Welcome to our shop. How can I help you today?',
            'We have that in different colors. Which one do you like?',
            'That will be 25 dollars in total. How would you like to pay?',
        ],
        closing: 'Thank you for shopping with us! Have a great day.',
    },
    {
        id: 'restaurant',
        title: 'Restoranda',
        intro: 'Siz restoranga keldingiz. Ofitsiant bilan buyurtma bering.',
        lines: [
            'Good evening! Table for how many people?',
            'Here is the menu. What would you like to order?',
            'Would you like anything to drink with that?',
        ],
        closing: 'Your order will be ready in 15 minutes. Enjoy your meal!',
    },
    {
        id: 'airport',
        title: 'Aeroportda',
        intro: 'Siz aeroportda check-in qilmoqchisiz.',
        lines: [
            'Good morning! May I see your passport and ticket, please?',
            'Do you have any luggage to check in?',
            'Your gate is B12, boarding starts in 40 minutes.',
        ],
        closing: 'Have a safe flight!',
    },
];

// ─── Slide content (speaking / live lesson) ─────────────────────────────────
const LD_SLIDE_TITLES = [
    ['Ochilish', 'Bugungi mavzuga qisqacha kirish'],
    ['Asosiy iboralar', "Suhbatda ko'p ishlatiladigan iboralar"],
    ['Namuna dialog', 'Haqiqiy hayotdagi misol suhbat'],
    ['Talaffuz maslahatlari', "To'g'ri talaffuz uchun maslahatlar"],
    ['Amaliyot', "O'zingiz sinab ko'ring"],
];

function ldBuildSlides(offset) {
    return LD_SLIDE_TITLES.map((t, i) => ({
        id: `slide-${offset}-${i}`,
        title: t[0],
        body: `${t[1]}. Ushbu slaydda o'qituvchi tomonidan tayyorlangan ko'rgazmali material joylashadi — rasm, misollar va qisqa izohlar bilan.`,
    }));
}

// ─── Homework builders ──────────────────────────────────────────────────────
function ldBuildGrammarHomework(offset) {
    return [
        { id: 'A', kind: 'matching', title: 'A-QISM — Moslashtirish', pairs: ldPickWindow(LD_MATCH_POOL, offset, 6) },
        { id: 'B', kind: 'fillBlank', title: "B-QISM — Bo'sh joylarni to'ldirish", blanks: ldPickWindow(LD_GRAMMAR_POOL, offset, 5) },
        { id: 'C', kind: 'multipleChoice', title: "C-QISM — To'g'ri javobni tanlash", questions: ldPickWindow(LD_MC_POOL, offset, 5) },
        { id: 'D', kind: 'sentenceBuild', title: 'D-QISM — Gap tuzish', items: ldPickWindow(LD_SENTENCE_POOL, offset, 4) },
        { id: 'creative', kind: 'creative', title: 'Ijodiy vazifa', instruction: "Bugungi mavzu bo'yicha 5-6 gapdan iborat qisqa matn yozing va agar xohlasangiz rasm biriktiring.", mediaType: 'text' },
    ];
}

function ldBuildSpeakingHomework(offset) {
    const scenario = LD_ROLEPLAY_SCENARIOS[offset % LD_ROLEPLAY_SCENARIOS.length];
    return [
        { id: 'A', kind: 'record', title: 'PART A — Record yourself', prompts: ldPickWindow(LD_SPEAKING_POOL, offset, 3) },
        { id: 'B', kind: 'roleplay', title: 'PART B — AI bilan suhbat / roleplay', scenario },
        { id: 'C', kind: 'pronunciation', title: 'PART C — Pronunciation check', prompts: ldPickWindow(LD_SPEAKING_POOL, offset + 3, 4) },
        { id: 'creative', kind: 'creative', title: 'Ijodiy vazifa', instruction: "Bugungi mavzu bo'yicha 30-40 soniyalik ovozli xabar yozib yuboring.", mediaType: 'audio' },
    ];
}

// ─── Bonus (Yakshanba) darslar — 6 kategoriya, 3 marta takrorlanadi = 18 dars ──
const LD_BONUS_CATEGORIES = [
    { key: 'movie', label: 'Kino tahlil', emoji: '🎬', color: '#DC2626', bg: '#FEE2E2', konspekt: "Ushbu darsda qisqa video parcha ingliz tilida tahlil qilinadi — muhim iboralar va so'zlashuv uslubi o'rganiladi." },
    { key: 'music', label: 'Musiqiy dars', emoji: '🎵', color: '#7C3AED', bg: '#EDE9FE', konspekt: "Ashula matni orqali yangi so'zlar va to'g'ri talaffuz mashq qilinadi." },
    { key: 'motivation', label: 'Motivatsion dars', emoji: '🌟', color: '#D97706', bg: '#FEF3C7', konspekt: "Shaxsiy rivojlanish va motivatsiya mavzusida ingliz tilida qisqa video ko'rib chiqiladi." },
    { key: 'quiz', label: "Intellektual o'yin", emoji: '🧠', color: '#2563EB', bg: '#DBEAFE', konspekt: "Quiz Night — bilimlaringizni ingliz tilida sinab ko'ring." },
    { key: 'slang', label: "Ko'cha ingliz tili", emoji: '🗣️', color: '#059669', bg: '#D1FAE5', konspekt: "Kundalik hayotda ishlatiladigan so'zlashuv iboralari va slenglar o'rganiladi." },
    { key: 'roleplay', label: 'Hayotiy vaziyat', emoji: '🎭', color: '#DB2777', bg: '#FCE7F3', konspekt: "Hayotiy vaziyatlar simulyatsiyasi orqali amaliy ingliz tili mashq qilinadi." },
];

function ldBuildBonusHomework(offset) {
    return [
        { id: 'A', kind: 'matching', title: 'A-QISM — Moslashtirish', pairs: ldPickWindow(LD_MATCH_POOL, offset, 6) },
        { id: 'B', kind: 'multipleChoice', title: "B-QISM — To'g'ri javobni tanlash", questions: ldPickWindow(LD_MC_POOL, offset, 5) },
        { id: 'C', kind: 'sentenceBuild', title: 'C-QISM — Gap tuzish', items: ldPickWindow(LD_SENTENCE_POOL, offset, 4) },
    ];
}

function getDefaultBonusLessonContent(bonusIndex) {
    const category = LD_BONUS_CATEGORIES[bonusIndex % LD_BONUS_CATEGORIES.length];
    const offset = ldHashId(`bonus-${bonusIndex}`);
    return {
        lessonId: `bonus-${bonusIndex + 1}`,
        dayType: 'bonus',
        unitTitle: `${category.emoji} ${category.label}`,
        konspekt: category.konspekt,
        slides: [],
        vocabulary: ldPickWindow(LD_VOCAB_POOL, offset, 10),
        grammarBlanks: [],
        speakingPractice: [],
        homeworkParts: ldBuildBonusHomework(offset),
    };
}

// ─── Imtihonlar — 6 ta oraliq (har 12 darsdan) + 1 ta yakunlovchi = 7 ta ───────
// student-app/data/exams.ts'dagi buildExams()/buildQuestions() bilan bir xil mantiq.
const LD_EXAM_INTERVAL_SIZE = 12;
const LD_EXAM_TOTAL_LESSONS = 72;
const LD_EXAM_INTERVAL_COUNT = LD_EXAM_TOTAL_LESSONS / LD_EXAM_INTERVAL_SIZE;

function ldBuildExamQuestions(offset, mcCount, sentenceCount, blankCount, speakingCount) {
    const mc = ldPickWindow(LD_MC_POOL, offset, mcCount).map((q) => ({
        kind: 'multipleChoice', id: `${q.id}-${offset}`, question: q.question, options: q.options, correctIndex: q.correctIndex,
    }));
    const sentence = ldPickWindow(LD_SENTENCE_POOL, offset, sentenceCount).map((q) => ({
        kind: 'sentenceBuild', id: `${q.id}-${offset}`, translation: q.translation, words: q.words, answer: q.answer,
    }));
    const blank = ldPickWindow(LD_GRAMMAR_POOL, offset, blankCount).map((q) => ({
        kind: 'fillBlank', id: `${q.id}-${offset}`, sentence: q.sentence, answer: q.answer, options: q.options,
    }));
    const speaking = ldPickWindow(LD_SPEAKING_POOL, offset, speakingCount).map((q) => ({
        kind: 'speaking', id: `${q.id}-${offset}`, sentence: q.sentence, translation: q.translation,
    }));
    return [...mc, ...blank, ...sentence, ...speaking];
}

const LD_EXAM_META = (() => {
    const list = [];
    for (let i = 0; i < LD_EXAM_INTERVAL_COUNT; i++) {
        const fromLesson = i * LD_EXAM_INTERVAL_SIZE + 1;
        const toLesson = fromLesson + LD_EXAM_INTERVAL_SIZE - 1;
        list.push({
            id: `interval-${i + 1}`,
            title: `${fromLesson}–${toLesson}-darslar imtihoni`,
            requiredLessons: toLesson,
            offset: i * 7,
            counts: { mc: 4, sentence: 3, blank: 3, speaking: 2 },
        });
    }
    list.push({
        id: 'final',
        title: 'Yakunlovchi kurs imtihoni',
        requiredLessons: LD_EXAM_TOTAL_LESSONS,
        offset: LD_EXAM_INTERVAL_COUNT * 7,
        counts: { mc: 6, sentence: 5, blank: 5, speaking: 4 },
    });
    return list;
})();

function getDefaultExamContent(examId) {
    const meta = LD_EXAM_META.find((e) => e.id === examId);
    if (!meta) return { passPercent: 60, questions: [] };
    const { mc, sentence, blank, speaking } = meta.counts;
    return {
        passPercent: 60,
        questions: ldBuildExamQuestions(meta.offset, mc, sentence, blank, speaking),
    };
}

// ─── Main entry point ───────────────────────────────────────────────────────
// student-app/data/lessonContent.ts ning getLessonContent() bilan bir xil natija beradi —
// faqat CRM tahrirlash formasini "hozir appda chiqib turgan" qiymatlar bilan
// oldindan to'ldirish uchun.
//
// `lang` — bu darsning kursi qaysi tilga tegishli ekani. Standart (proseduraviy)
// kontent faqat INGLIZCHA havzalardan tuziladi — rus tili kursi uchun admin
// hali haqiqiy kontent kiritmagan bo'lsa, CRM'da ham (xuddi ilovadagi kabi)
// bo'sh ro'yxat ko'rsatiladi, aks holda admin "tayyor" deb o'ylab, aslida
// ingliz tilidagi placeholder'ni tekshirmasdan saqlab qo'yishi mumkin edi.
function getDefaultLessonContent(lessonId, dayIndex, lang) {
    const dayType = dayIndex % 2 === 0 ? 'grammar' : 'speaking';
    const offset = ldHashId(String(lessonId));
    const isRussian = lang === 'russian';

    return {
        lessonId: String(lessonId),
        dayType,
        unitTitle: dayType === 'grammar' ? 'Grammar & Video dars' : 'Speaking & Live dars',
        konspekt:
            dayType === 'grammar'
                ? "Ushbu darsda asosiy grammatik qoida video orqali tushuntiriladi. Video tagida qisqacha konspekt joylashgan — asosiy formula va misollarni shu yerdan takrorlashingiz mumkin."
                : "Ushbu live darsda o'qituvchi tomonidan tayyorlangan slaydlar asosida suhbat ko'nikmalari mashq qilinadi.",
        slides: !isRussian && dayType === 'speaking' ? ldBuildSlides(offset) : [],
        vocabulary: isRussian ? (dayIndex === 0 ? LD_RU_LESSON1_VOCAB : []) : ldPickWindow(LD_VOCAB_POOL, offset, 25),
        grammarBlanks: isRussian
            ? (dayIndex === 0 ? LD_RU_LESSON1_GRAMMAR : [])
            : (dayType === 'grammar' ? ldPickWindow(LD_GRAMMAR_POOL, offset, 6) : []),
        speakingPractice: !isRussian && dayType === 'speaking' ? ldPickWindow(LD_SPEAKING_POOL, offset, 5) : [],
        homeworkParts: isRussian
            ? (dayIndex === 0 ? LD_RU_LESSON1_HOMEWORK : dayIndex === 1 ? LD_RU_LESSON2_HOMEWORK : [])
            : (dayType === 'grammar' ? ldBuildGrammarHomework(offset) : ldBuildSpeakingHomework(offset)),
    };
}
