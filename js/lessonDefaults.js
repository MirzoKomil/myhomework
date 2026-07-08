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
        { id: 'A', kind: 'matching', title: 'PART A — Matching', pairs: ldPickWindow(LD_MATCH_POOL, offset, 6) },
        { id: 'B', kind: 'fillBlank', title: 'PART B — Fill in the blank', blanks: ldPickWindow(LD_GRAMMAR_POOL, offset, 5) },
        { id: 'C', kind: 'multipleChoice', title: 'PART C — Multiple choice', questions: ldPickWindow(LD_MC_POOL, offset, 5) },
        { id: 'D', kind: 'sentenceBuild', title: 'PART D — Sentence building', items: ldPickWindow(LD_SENTENCE_POOL, offset, 4) },
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

// ─── Main entry point ───────────────────────────────────────────────────────
// student-app/data/lessonContent.ts ning getLessonContent() bilan bir xil natija beradi —
// faqat CRM tahrirlash formasini "hozir appda chiqib turgan" qiymatlar bilan
// oldindan to'ldirish uchun.
function getDefaultLessonContent(lessonId, dayIndex) {
    const dayType = dayIndex % 2 === 0 ? 'grammar' : 'speaking';
    const offset = ldHashId(String(lessonId));

    return {
        lessonId: String(lessonId),
        dayType,
        unitTitle: dayType === 'grammar' ? 'Grammar & Video dars' : 'Speaking & Live dars',
        konspekt:
            dayType === 'grammar'
                ? "Ushbu darsda asosiy grammatik qoida video orqali tushuntiriladi. Video tagida qisqacha konspekt joylashgan — asosiy formula va misollarni shu yerdan takrorlashingiz mumkin."
                : "Ushbu live darsda o'qituvchi tomonidan tayyorlangan slaydlar asosida suhbat ko'nikmalari mashq qilinadi.",
        slides: dayType === 'speaking' ? ldBuildSlides(offset) : [],
        vocabulary: ldPickWindow(LD_VOCAB_POOL, offset, 25),
        grammarBlanks: dayType === 'grammar' ? ldPickWindow(LD_GRAMMAR_POOL, offset, 6) : [],
        speakingPractice: dayType === 'speaking' ? ldPickWindow(LD_SPEAKING_POOL, offset, 5) : [],
        homeworkParts: dayType === 'grammar' ? ldBuildGrammarHomework(offset) : ldBuildSpeakingHomework(offset),
    };
}
