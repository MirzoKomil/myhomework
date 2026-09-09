// @Homework_HR_bot — vakansiyalarga ariza qabul qiluvchi Telegram bot
// (18-vazifa). Nomzod anketani to'liq to'ldirgach, ma'lumot to'g'ridan-to'g'ri
// CRM'ning HR → Vakansiya voronkasiga "Kandidatlar" ustuniga tushadi.
//
// MUHIM: TELEGRAM_HR_BOT_TOKEN — parol bilan barobar. Faqat serverning o'z
// muhitida (.env / Railway Variables) saqlanadi, kodga hech qachon
// yozilmaydi va logga tushmaydi.
//
// Suhbat holati (kimning qaysi savolda turgani) xotirada emas, BAZADA
// saqlanadi (hr_bot_sessions) — Railway konteyneri qayta ishga tushsa ham
// nomzod yarim to'ldirgan anketasini yo'qotmaydi.
const {
    insertCandidate, addMedia,
    getBotSession, saveBotSession, clearBotSession,
} = require('./hrCandidates');
const { VACANCIES, VACANCY_BY_ID } = require('./hrStages');
const { questionsForVacancy } = require('./hrQuestions');

const TOKEN = process.env.TELEGRAM_HR_BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${TOKEN}`;

const CHANNEL_URL = process.env.HR_BOT_CHANNEL_URL || 'https://t.me/homework_jobss';
// HR menejerining Telegram profili — TZ da "HR bilan aloqa" tugmasi uchun.
// Sozlanmagan bo'lsa tugma bosilganda buni aniq aytadi (jim qolmaydi).
const HR_CONTACT = process.env.HR_BOT_CONTACT_USERNAME || '';
// "Biz haqimizda" bo'limidagi video taqdimot havolasi (ixtiyoriy).
const ABOUT_VIDEO = process.env.HR_BOT_ABOUT_VIDEO_URL || '';

if (!TOKEN) {
    console.warn('[hr-bot] OGOHLANTIRISH: TELEGRAM_HR_BOT_TOKEN o\'rnatilmagan — '
        + 'HR boti ishlamaydi. Railway Variables\'da o\'rnating.');
}

// ── Telegram API ────────────────────────────────────────────────────────────

async function tg(method, payload) {
    if (!TOKEN) return null;
    try {
        const res = await fetch(`${API}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) console.error(`[hr-bot] ${method} xatoligi:`, data.description);
        return data;
    } catch (err) {
        console.error(`[hr-bot] ${method} yuborilmadi:`, err.message);
        return null;
    }
}

const send = (chatId, text, extra = {}) =>
    tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });

const inline = (rows) => ({ reply_markup: { inline_keyboard: rows } });

// Telegram fayllarini vaqtinchalik serverdan yuklab olib, bazaga o'tkazish
// uchun. Telegram'ning file_path havolasi ~1 soatda eskiradi, shuning uchun
// fayl anketa yakunlanishi bilanoq yuklab olinadi (TZ, 5.3-band).
async function downloadTelegramFile(fileId) {
    if (!TOKEN || !fileId) return null;
    try {
        const info = await tg('getFile', { file_id: fileId });
        const filePath = info?.result?.file_path;
        if (!filePath) return null;
        const res = await fetch(`${FILE_API}/${filePath}`);
        if (!res.ok) return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        return { buffer, filePath };
    } catch (err) {
        console.error('[hr-bot] Fayl yuklab olinmadi:', err.message);
        return null;
    }
}

function mimeFromPath(filePath, fallback) {
    const ext = String(filePath || '').split('.').pop().toLowerCase();
    const map = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
        ogg: 'audio/ogg', oga: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4',
        mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    };
    return map[ext] || fallback || 'application/octet-stream';
}

// ── Menyu matnlari ──────────────────────────────────────────────────────────

const MAIN_MENU = inline([
    [{ text: "💼 Bo'sh ish o'rinlari", callback_data: 'menu:vacancies' }],
    [{ text: '🏢 Biz haqimizda', callback_data: 'menu:about' }],
    [{ text: '✨ Nega aynan biz?', callback_data: 'menu:why' }],
    [{ text: '❓ Ko\'p beriladigan savollar', callback_data: 'menu:faq' }],
    [{ text: '📞 HR bilan aloqa', callback_data: 'menu:contact' }],
]);

const WELCOME = 'Assalomu alaykum! 👋\n\n'
    + '<b>Homework</b> jamoasiga xush kelibsiz.\n\n'
    + "Biz onlayn ta'lim beruvchi maktabmiz va jamoamizga yangi hamkasblarni "
    + 'qidirmoqdamiz. Quyidagi bo\'limlardan birini tanlang:';

const ABOUT_TEXT = '🏢 <b>Biz haqimizda</b>\n\n'
    + "Homework — ingliz va rus tillarini onlayn o'rgatuvchi maktab. "
    + "Darslar onlayn o'tiladi, biroq jamoamiz to'liq ofisda birga ishlaydi — "
    + "shu sababli bir-birimizdan tez o'rganamiz va natijaga birga erishamiz.\n\n"
    + "<b>Qadriyatlarimiz:</b>\n"
    + "• O'quvchining haqiqiy natijasi — asosiy o'lchov\n"
    + '• Ochiq muloqot va o\'zaro yordam\n'
    + "• Har bir xodimning o'sishi uchun sharoit\n\n"
    + "Jamoamiz yosh, jonli va bir-birini qo'llab-quvvatlaydi.";

const WHY_TEXT = '✨ <b>Nega aynan biz?</b>\n\n'
    + '🏢 <b>Zamonaviy ofis</b> — qulay ish joyi, kerakli texnika bilan ta\'minlangan\n\n'
    + "🤝 <b>Do'stona jamoa</b> — yosh va qo'llab-quvvatlovchi hamkasblar\n\n"
    + "💰 <b>O'z vaqtida oylik</b> — kechikishlarsiz, shaffof hisob-kitob\n\n"
    + "📈 <b>Martaba o'sishi</b> — natijaga qarab lavozim va daromad o'sadi\n\n"
    + "🎓 <b>Ichki o'quv</b> — ishga kirgan kundan boshlab o'rgatamiz";

const FAQ_TEXT = '❓ <b>Ko\'p beriladigan savollar</b>\n\n'
    + '<b>Tanlov qanday bosqichlardan iborat?</b>\n'
    + "Ariza → HR bilan suhbat → amaliy topshiriq/test → yakuniy suhbat → ish taklifi.\n\n"
    + '<b>Ish ofisdami yoki masofadan?</b>\n'
    + "Darslar onlayn o'tiladi, lekin barcha xodimlar ofisga kelib ishlaydi.\n\n"
    + '<b>Sinov muddati bormi?</b>\n'
    + "Ha, sinov muddati mavjud. Uning davomiyligi va shartlari suhbatda "
    + 'aniq aytiladi.\n\n'
    + '<b>Talabalar ishlashi mumkinmi?</b>\n'
    + "Ba'zi vakansiyalarda ha. Anketada ish grafigi haqida so'raladi.\n\n"
    + '<b>Rezyume (CV) kerakmi?</b>\n'
    + "Yo'q. Anketani to'ldirasiz va 1 dona rasmingizni yuborasiz — shunisi yetarli.";

function contactText() {
    if (HR_CONTACT) {
        const username = HR_CONTACT.replace(/^@/, '');
        return '📞 <b>HR bilan aloqa</b>\n\n'
            + `Savollaringiz bo'lsa, HR menejerimizga to'g'ridan-to'g'ri yozing: `
            + `@${username}`;
    }
    return '📞 <b>HR bilan aloqa</b>\n\n'
        + "Hozircha HR menejeri profili ulanmagan. Iltimos, arizangizni "
        + "to'ldiring — mutaxassisimiz o'zi siz bilan bog'lanadi.";
}

const BACK_ROW = [{ text: '⬅️ Bosh menyu', callback_data: 'menu:main' }];

// ── Savol yuborish ──────────────────────────────────────────────────────────

async function askQuestion(chatId, session) {
    const questions = questionsForVacancy(session.vacancyId);
    const q = questions[session.step];
    if (!q) return finishApplication(chatId, session);

    const progress = `<i>${session.step + 1}/${questions.length}</i>\n\n`;
    const text = progress + q.text;

    if (q.type === 'choice') {
        const rows = q.options.map(o => [{
            text: o.label,
            callback_data: `ans:${q.key}:${o.id}`,
        }]);
        return send(chatId, text, inline(rows));
    }

    if (q.type === 'contact') {
        return send(chatId, text, {
            reply_markup: {
                keyboard: [[{ text: q.buttonText, request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        });
    }

    // text / photo / voice / media / video — oddiy xabar kutiladi
    return send(chatId, text, { reply_markup: { remove_keyboard: true } });
}

// Javob qabul qilingach keyingi savolga o'tadi.
async function advance(chatId, session) {
    session.step += 1;
    await saveBotSession(session.telegramUserId, session);
    return askQuestion(chatId, session);
}

// ── Anketani yakunlash ──────────────────────────────────────────────────────

async function finishApplication(chatId, session) {
    const vacancy = VACANCY_BY_ID.get(session.vacancyId);
    const a = session.answers || {};

    // Umumiy blok maydonlari alohida ustunlarga, vakansiyaga xos javoblar
    // esa answers JSONB ichiga tushadi (TZ, 5.2-banddagi payload shakli).
    const generalKeys = new Set(['full_name', 'telegram_phone', 'contact_phone',
        'address', 'birth_year', 'has_laptop', 'ready_for_office', 'photo']);
    const specificAnswers = {};
    for (const [k, v] of Object.entries(a)) {
        if (!generalKeys.has(k)) specificAnswers[k] = v;
    }

    let candidate;
    try {
        candidate = await insertCandidate({
            telegramUserId: session.telegramUserId,
            telegramUsername: session.telegramUsername,
            fullName: a.full_name,
            telegramPhone: a.telegram_phone,
            contactPhone: a.contact_phone,
            address: a.address,
            birthYear: a.birth_year,
            hasLaptop: a.has_laptop,
            readyForOffice: a.ready_for_office,
            vacancyId: session.vacancyId,
            vacancyName: vacancy?.label || '',
            answers: specificAnswers,
            utmSource: session.utmSource || '',
        });
    } catch (err) {
        console.error('[hr-bot] Nomzod saqlanmadi:', err.message);
        await send(chatId, "Kechirasiz, texnik nosozlik yuz berdi. Iltimos, biroz "
            + "kutib /start ni qayta bosing — ma'lumotlaringiz saqlanmadi.");
        return;
    }

    // Media fayllar: anketa yakunlangach yuklab olinib, bazaga o'tkaziladi.
    // Xato bo'lsa ariza baribir saqlanib qoladi — nomzod mehnati yo'qolmaydi.
    for (const [kind, fileId] of Object.entries(session.media || {})) {
        if (!fileId) continue;
        const file = await downloadTelegramFile(fileId);
        if (!file) {
            console.warn(`[hr-bot] ${kind} yuklab olinmadi, nomzod=${candidate.id}`);
            continue;
        }
        await addMedia(candidate.id, kind, file.buffer,
            mimeFromPath(file.filePath), file.filePath.split('/').pop())
            .catch(err => console.error(`[hr-bot] ${kind} saqlanmadi:`, err.message));
    }

    await clearBotSession(session.telegramUserId);

    console.log(`[hr-bot] ARIZA QABUL QILINDI  id=${candidate.id} `
        + `vakansiya="${vacancy?.label}" ism="${candidate.fullName}"`);

    await send(chatId,
        'Rahmat! ✅\n\n'
        + 'Arizangiz muvaffaqiyatli qabul qilindi va CRM tizimimizga yuborildi. '
        + "Tez orada HR mutaxassisimiz siz bilan bog'lanadi.\n\n"
        + 'Kasting jarayonlari, yangi ochiq ish o\'rinlari va loyiha yangiliklaridan '
        + "xabardor bo'lish uchun rasmiy kanalimizga a'zo bo'ling: 👇",
        inline([
            [{ text: '📢 Kanalga ulanish', url: CHANNEL_URL }],
            [{ text: '💼 Boshqa vakansiyaga ariza', callback_data: 'menu:vacancies' }],
        ])
    );
}

// ── Kiruvchi xabarlarni qayta ishlash ───────────────────────────────────────

async function showVacancies(chatId) {
    const rows = VACANCIES.map(v => [{ text: v.label, callback_data: `vac:${v.id}` }]);
    rows.push(BACK_ROW);
    return send(chatId, "💼 <b>Bo'sh ish o'rinlari</b>\n\nQaysi lavozimga ariza "
        + 'bermoqchisiz?', inline(rows));
}

async function handleCallback(cb) {
    const chatId = cb.message?.chat?.id;
    const userId = String(cb.from?.id || '');
    const data = cb.data || '';
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    if (!chatId) return;

    if (data === 'menu:main') return send(chatId, WELCOME, MAIN_MENU);
    if (data === 'menu:vacancies') return showVacancies(chatId);
    if (data === 'menu:about') {
        await send(chatId, ABOUT_TEXT, inline([BACK_ROW]));
        if (ABOUT_VIDEO) await send(chatId, `🎬 Video taqdimot: ${ABOUT_VIDEO}`);
        return;
    }
    if (data === 'menu:why') return send(chatId, WHY_TEXT, inline([BACK_ROW]));
    if (data === 'menu:faq') return send(chatId, FAQ_TEXT, inline([BACK_ROW]));
    if (data === 'menu:contact') return send(chatId, contactText(), inline([BACK_ROW]));

    if (data.startsWith('vac:')) {
        const vacancyId = data.slice(4);
        if (!VACANCY_BY_ID.has(vacancyId)) return showVacancies(chatId);
        const session = {
            telegramUserId: userId,
            telegramUsername: cb.from?.username || '',
            vacancyId,
            step: 0,
            answers: {},
            media: {},
            utmSource: '',
        };
        await saveBotSession(userId, session);
        await send(chatId, `Tanlandi: <b>${VACANCY_BY_ID.get(vacancyId).label}</b>\n\n`
            + "Endi bir necha savolga javob berasiz. Boshladik 👇");
        return askQuestion(chatId, session);
    }

    if (data.startsWith('ans:')) {
        const [, key, optionId] = data.split(':');
        const session = await getBotSession(userId);
        if (!session) return send(chatId, 'Suhbat topilmadi. /start ni bosing.');
        const questions = questionsForVacancy(session.vacancyId);
        const q = questions[session.step];
        if (!q || q.key !== key || q.type !== 'choice') return;   // eskirgan tugma
        const option = q.options.find(o => o.id === optionId);
        if (!option) return;
        session.answers[key] = 'value' in option ? option.value : option.label;
        return advance(chatId, session);
    }
}

async function handleMessage(msg) {
    const chatId = msg.chat?.id;
    const userId = String(msg.from?.id || '');
    if (!chatId) return;

    const text = (msg.text || '').trim();

    if (text.startsWith('/start')) {
        // "/start target_instagram" — reklama manbasini uzatish uchun (TZ:
        // utm_source). Boshlangan anketa bo'lsa u bekor qilinadi.
        const payload = text.split(/\s+/)[1] || '';
        await clearBotSession(userId);
        if (payload) {
            await saveBotSession(userId, { pendingUtm: payload, telegramUserId: userId });
        }
        return send(chatId, WELCOME, MAIN_MENU);
    }

    if (text === '/menyu' || text === '/menu') return send(chatId, WELCOME, MAIN_MENU);

    const session = await getBotSession(userId);
    if (!session || !session.vacancyId) {
        return send(chatId, 'Boshlash uchun quyidagi menyudan tanlang:', MAIN_MENU);
    }

    const questions = questionsForVacancy(session.vacancyId);
    const q = questions[session.step];
    if (!q) return finishApplication(chatId, session);

    // Har bir savol turi FAQAT o'ziga mos javobni qabul qiladi — noto'g'ri
    // format kelsa savol qayta so'raladi, anketa oldinga siljimaydi.
    switch (q.type) {
        case 'contact': {
            const phone = msg.contact?.phone_number;
            if (!phone) {
                return send(chatId, "Iltimos, pastdagi «📱 Raqamni ulashish» tugmasini "
                    + "bosing — raqamni qo'lda yozish qabul qilinmaydi.", {
                    reply_markup: {
                        keyboard: [[{ text: q.buttonText, request_contact: true }]],
                        resize_keyboard: true, one_time_keyboard: true,
                    },
                });
            }
            // Boshqa odamning kontaktini yuborishning oldini olamiz.
            if (msg.contact.user_id && String(msg.contact.user_id) !== userId) {
                return send(chatId, "Iltimos, o'zingizning raqamingizni ulashing.");
            }
            session.answers[q.key] = phone.startsWith('+') ? phone : `+${phone}`;
            return advance(chatId, session);
        }

        case 'photo': {
            const photos = msg.photo;
            if (!Array.isArray(photos) || !photos.length) {
                return send(chatId, 'Iltimos, rasm yuboring (fayl sifatida emas, '
                    + 'oddiy rasm ko\'rinishida).');
            }
            session.media.photo = photos[photos.length - 1].file_id;   // eng sifatlisi
            session.answers[q.key] = 'yuborildi';
            return advance(chatId, session);
        }

        case 'voice': {
            const fileId = msg.voice?.file_id || msg.audio?.file_id;
            if (!fileId) {
                return send(chatId, "Iltimos, ovozli xabar (Voice) yuboring — "
                    + 'mikrofon tugmasini bosib ushlab turing.');
            }
            session.media.voice = fileId;
            session.answers[q.key] = 'yuborildi';
            return advance(chatId, session);
        }

        case 'video': {
            const fileId = msg.video?.file_id || msg.video_note?.file_id;
            if (!fileId) {
                return send(chatId, 'Iltimos, video yoki dumaloq video (krujok) yuboring.');
            }
            session.media.video = fileId;
            session.answers[q.key] = 'yuborildi';
            return advance(chatId, session);
        }

        case 'media': {
            const voiceId = msg.voice?.file_id || msg.audio?.file_id;
            const videoId = msg.video?.file_id || msg.video_note?.file_id;
            if (!voiceId && !videoId) {
                return send(chatId, 'Iltimos, ovozli xabar (Voice) yoki video yuboring.');
            }
            if (voiceId) session.media.voice = voiceId;
            else session.media.video = videoId;
            session.answers[q.key] = 'yuborildi';
            return advance(chatId, session);
        }

        default: {   // text
            if (!text) return send(chatId, 'Iltimos, javobni matn ko\'rinishida yozing.');
            session.answers[q.key] = text.slice(0, 1000);
            return advance(chatId, session);
        }
    }
}

async function handleUpdate(update) {
    if (update.callback_query) return handleCallback(update.callback_query);
    if (update.message) return handleMessage(update.message);
}

// Webhook manzilini Telegram'ga bir marta ro'yxatdan o'tkazish uchun.
async function setWebhook(url, secretToken) {
    return tg('setWebhook', {
        url,
        secret_token: secretToken || undefined,
        allowed_updates: ['message', 'callback_query'],
    });
}

module.exports = { handleUpdate, setWebhook, hasToken: () => Boolean(TOKEN) };
