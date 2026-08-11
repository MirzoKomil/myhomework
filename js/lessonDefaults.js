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

// ─── Bonus (Yakshanba) darslar — 6 kategoriya, 3 marta takrorlanadi = 18 dars ──
const LD_BONUS_CATEGORIES = [
    { key: 'movie', label: 'Kino tahlil', emoji: '🎬', color: '#DC2626', bg: '#FEE2E2', konspekt: "Ushbu darsda qisqa video parcha ingliz tilida tahlil qilinadi — muhim iboralar va so'zlashuv uslubi o'rganiladi." },
    { key: 'music', label: 'Musiqiy dars', emoji: '🎵', color: '#7C3AED', bg: '#EDE9FE', konspekt: "Ashula matni orqali yangi so'zlar va to'g'ri talaffuz mashq qilinadi." },
    { key: 'motivation', label: 'Motivatsion dars', emoji: '🌟', color: '#D97706', bg: '#FEF3C7', konspekt: "Shaxsiy rivojlanish va motivatsiya mavzusida ingliz tilida qisqa video ko'rib chiqiladi." },
    { key: 'quiz', label: "Intellektual o'yin", emoji: '🧠', color: '#2563EB', bg: '#DBEAFE', konspekt: "Quiz Night — bilimlaringizni ingliz tilida sinab ko'ring." },
    { key: 'slang', label: "Ko'cha ingliz tili", emoji: '🗣️', color: '#059669', bg: '#D1FAE5', konspekt: "Kundalik hayotda ishlatiladigan so'zlashuv iboralari va slenglar o'rganiladi." },
    { key: 'roleplay', label: 'Hayotiy vaziyat', emoji: '🎭', color: '#DB2777', bg: '#FCE7F3', konspekt: "Hayotiy vaziyatlar simulyatsiyasi orqali amaliy ingliz tili mashq qilinadi." },
];

function getDefaultBonusLessonContent(bonusIndex) {
    const category = LD_BONUS_CATEGORIES[bonusIndex % LD_BONUS_CATEGORIES.length];
    return {
        lessonId: `bonus-${bonusIndex + 1}`,
        dayType: 'bonus',
        unitTitle: `${category.emoji} ${category.label}`,
        konspekt: category.konspekt,
        slides: [],
        vocabulary: [],
        grammarBlanks: [],
        speakingPractice: [],
        homeworkParts: [],
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
// 52-vazifa: ilgari bu yerda "namuna" (proseduraviy generatsiya qilingan)
// kontent bilan CRM formasi oldindan to'ldirilardi — ingliz tili uchun
// LD_VOCAB_POOL/LD_GRAMMAR_POOL kabi havzalardan, rus tili uchun esa
// manba kodiga qattiq yozilgan LD_RU_LESSON1_*/LD_RU_LESSON2_*
// konstantalardan. Bu ikkalasi ham HAQIQIY, admin CRM orqali kiritgan
// kontent EMAS edi. Endi bazaviy kontent har doim BO'SH — CRM formasi
// faqat admin haqiqatan saqlagan (mc.lessonContents) kontentni ko'rsatadi,
// hech qanday "namuna" bilan oldindan to'ldirilmaydi.
function getDefaultLessonContent(lessonId, dayIndex, lang) {
    const dayType = dayIndex % 2 === 0 ? 'grammar' : 'speaking';

    return {
        lessonId: String(lessonId),
        dayType,
        unitTitle: dayType === 'grammar' ? 'Grammar & Video dars' : 'Speaking & Live dars',
        konspekt:
            dayType === 'grammar'
                ? "Ushbu darsda asosiy grammatik qoida video orqali tushuntiriladi. Video tagida qisqacha konspekt joylashgan — asosiy formula va misollarni shu yerdan takrorlashingiz mumkin."
                : "Ushbu live darsda o'qituvchi tomonidan tayyorlangan slaydlar asosida suhbat ko'nikmalari mashq qilinadi.",
        slides: [],
        vocabulary: [],
        grammarBlanks: [],
        speakingPractice: [],
        homeworkParts: [],
    };
}
