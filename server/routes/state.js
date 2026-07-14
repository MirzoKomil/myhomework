const express = require('express');
const { getFullState, patchState, getMobileContentData, getDemoStudentGrades, submitDemoStudentTeacherRating, getDemoStudentSchedule, getDemoStudentProfile, getDemoStudentMessages, sendDemoStudentMessage, getDemoStudentPeerMessages, sendDemoStudentPeerMessage, getDemoStudentPersonaMessages, sendDemoStudentPersonaMessage, getDemoStudentBookDelivery, getDemoStudentActivity, addDemoStudentActivity, getCommunityPosts, addCommunityPost, toggleCommunityPostLike, addCommunityComment, toggleCommunityCommentLike, deleteCommunityPost, deleteCommunityComment, addDemoShopOrder, getDemoShopOrders } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Public endpoint — student app uchun, auth talab qilmaydi
router.get('/mobile-content', async (req, res) => {
    try {
        const mc = await getMobileContentData();
        res.json(mc);
    } catch (err) {
        console.error('GET /api/state/mobile-content', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchining CRM'da admin kiritgan haqiqiy parolini qaytaradi (profil
// ekranidagi "Parol" bosilganda ko'rsatish uchun).
router.get('/demo-profile', async (req, res) => {
    try {
        const data = await getDemoStudentProfile();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-profile', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchining jonli dars baholarini (va ustozning agregat reytingini)
// qaytaradi. Boshqa o'quvchilarning ma'lumotlari hech qachon shu orqali
// oshkor qilinmaydi.
router.get('/demo-grades', async (req, res) => {
    try {
        const data = await getDemoStudentGrades();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-grades', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — namuna o'quvchi ilovadan ustozni baholaganda shu yerga
// yuboradi. StudentId har doim serverda demoStudentId'dan olinadi — mijozdan
// kelgan hech qanday qiymatga ishonilmaydi, shuning uchun bu boshqa hech bir
// o'quvchi ma'lumotini yoza olmaydi.
router.post('/demo-grades/rate-teacher', async (req, res) => {
    try {
        const { date, ratings } = req.body || {};
        if (!date || !ratings || typeof ratings !== 'object') {
            return res.status(400).json({ error: "Sana va baholar yuborilishi shart" });
        }
        await submitDemoStudentTeacherRating(date, ratings);
        res.json({ ok: true });
    } catch (err) {
        console.error('POST /api/state/demo-grades/rate-teacher', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// Public endpoint — faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchining Telegram guruh havolasi va navbatdagi speaking dars vaqtini
// qaytaradi. StudentId har doim serverda demoStudentId'dan olinadi.
router.get('/demo-schedule', async (req, res) => {
    try {
        const data = await getDemoStudentSchedule();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-schedule', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchining uchta suhbat (Qo'llab-quvvatlash/Asosiy ustoz/Yordamchi
// ustoz) xabarlarini qaytaradi. StudentId har doim serverda demoStudentId'dan
// olinadi.
router.get('/demo-messages', async (req, res) => {
    try {
        const data = await getDemoStudentMessages();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-messages', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — namuna o'quvchi ilovadan xabar yozganda shu yerga
// yuboradi. StudentId har doim serverda demoStudentId'dan olinadi — mijozdan
// kelgan hech qanday qiymatga ishonilmaydi.
router.post('/demo-messages', async (req, res) => {
    try {
        const { threadId, text } = req.body || {};
        if (!threadId || typeof text !== 'string') {
            return res.status(400).json({ error: "Suhbat va xabar matni yuborilishi shart" });
        }
        const message = await sendDemoStudentMessage(threadId, text);
        res.json({ ok: true, message });
    } catch (err) {
        console.error('POST /api/state/demo-messages', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// Public endpoint — faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchining barcha "hamkurs" (Maqsaddoshlar) suhbatlarini qaytaradi.
router.get('/demo-peer-messages', async (req, res) => {
    try {
        const data = await getDemoStudentPeerMessages();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-peer-messages', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — namuna o'quvchi ilovadan hamkursiga xabar yozganda shu
// yerga yuboradi. StudentId har doim serverda demoStudentId'dan olinadi.
router.post('/demo-peer-messages', async (req, res) => {
    try {
        const { peerId, peerName, text } = req.body || {};
        if (!peerId || typeof text !== 'string') {
            return res.status(400).json({ error: "Hamkurs va xabar matni yuborilishi shart" });
        }
        const message = await sendDemoStudentPeerMessage(peerId, peerName, text);
        res.json({ ok: true, message });
    } catch (err) {
        console.error('POST /api/state/demo-peer-messages', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// 140-ish: "Afsonalar" (Legends) — namuna o'quvchining AI-personajlar bilan
// suhbatlari. Faqat monitoring uchun (CRM javob yozmaydi) - shu sabab public
// GET/POST yetarli, alohida authRequired endpoint kerak emas.
router.get('/demo-persona-messages', async (req, res) => {
    try {
        const data = await getDemoStudentPersonaMessages();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-persona-messages', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.post('/demo-persona-messages', async (req, res) => {
    try {
        const { personaId, personaName, text, sender } = req.body || {};
        if (!personaId || typeof text !== 'string') {
            return res.status(400).json({ error: "Personaj va xabar matni yuborilishi shart" });
        }
        const message = await sendDemoStudentPersonaMessage(personaId, personaName, text, sender);
        res.json({ ok: true, message });
    } catch (err) {
        console.error('POST /api/state/demo-persona-messages', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// Public endpoint — faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchining haqiqiy kitob yetkazib berish holatini (Sotuv bo'limidagi
// "Kitob yetkazish" kanban-yozuvidan) qaytaradi. Topilmasa — null.
router.get('/demo-book-delivery', async (req, res) => {
    try {
        const data = await getDemoStudentBookDelivery();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-book-delivery', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — faqat CRM'da "Namuna o'quvchi" deb belgilangan bitta
// o'quvchining oxirgi imtihon/uyga vazifa/video/lug'at mashqi natijalarini
// qaytaradi (ustoz kabineti va admin profili shu yerdan kuzatadi).
router.get('/demo-activity', async (req, res) => {
    try {
        const data = await getDemoStudentActivity();
        res.json(data);
    } catch (err) {
        console.error('GET /api/state/demo-activity', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

// Public endpoint — namuna o'quvchi ilovada mashq/imtihonni yakunlaganda
// haqiqiy natijasini shu yerga yozadi. StudentId har doim serverda
// demoStudentId'dan olinadi.
router.post('/demo-activity', async (req, res) => {
    try {
        const { type, label, scorePercent, passed, wrongAttempts, mistakes } = req.body || {};
        if (!type || typeof label !== 'string') {
            return res.status(400).json({ error: "Faoliyat turi va nomi yuborilishi shart" });
        }
        const record = await addDemoStudentActivity({ type, label, scorePercent, passed, wrongAttempts, mistakes });
        res.json({ ok: true, record });
    } catch (err) {
        console.error('POST /api/state/demo-activity', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// Hamjamiyat (Community) — bitta umumiy lenta, namuna o'quvchi ilovadan va
// CRM administratoridan bir xil ko'rinadi. O'qish hammaga ochiq (public);
// post/izoh qo'shish va like bosish ham public (ilovada login yo'q — yagona
// haqiqiy foydalanuvchi namuna o'quvchi); FAQAT o'chirish operatsiyalari
// admin autentifikatsiyasini talab qiladi.
router.get('/community', async (req, res) => {
    try {
        res.json({ posts: await getCommunityPosts() });
    } catch (err) {
        console.error('GET /api/state/community', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.post('/community/posts', async (req, res) => {
    try {
        const { text, authorName, authorEmoji, imageUri } = req.body || {};
        const post = await addCommunityPost(text, authorName, authorEmoji, imageUri);
        res.json({ ok: true, post });
    } catch (err) {
        console.error('POST /api/state/community/posts', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/community/posts/:postId/like', async (req, res) => {
    try {
        const post = await toggleCommunityPostLike(req.params.postId);
        res.json({ ok: true, post });
    } catch (err) {
        console.error('POST /api/state/community/posts/:postId/like', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/community/posts/:postId/comments', async (req, res) => {
    try {
        const { text, parentId, authorName, authorEmoji } = req.body || {};
        const comment = await addCommunityComment(req.params.postId, text, parentId, authorName, authorEmoji);
        res.json({ ok: true, comment });
    } catch (err) {
        console.error('POST /api/state/community/posts/:postId/comments', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.post('/community/posts/:postId/comments/:commentId/like', async (req, res) => {
    try {
        const comment = await toggleCommunityCommentLike(req.params.postId, req.params.commentId);
        res.json({ ok: true, comment });
    } catch (err) {
        console.error('POST /api/state/community/posts/:postId/comments/:commentId/like', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// Faqat CRM admin — istalgan postni yoki izohni butunlay o'chiradi.
router.delete('/community/posts/:postId', authRequired, async (req, res) => {
    try {
        await deleteCommunityPost(req.params.postId);
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /api/state/community/posts/:postId', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.delete('/community/posts/:postId/comments/:commentId', authRequired, async (req, res) => {
    try {
        await deleteCommunityComment(req.params.postId, req.params.commentId);
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /api/state/community/posts/:postId/comments/:commentId', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

// 139-ish: Homework Shop buyurtmalarining yetkazib berish holati — namuna
// o'quvchi ilova orqali buyurtma qo'shadi (public), o'zining buyurtmalarini
// o'qiydi (public). Bosqichni o'zgartirish (Kanban'da surish) esa CRM'ning
// umumiy PATCH /api/state -> shopOrders kaliti orqali (authRequired) amalga
// oshadi — bookRoadmap bilan bir xil naqsh.
router.get('/demo-shop-orders', async (req, res) => {
    try {
        res.json({ orders: await getDemoShopOrders() });
    } catch (err) {
        console.error('GET /api/state/demo-shop-orders', err);
        res.status(500).json({ error: 'Xatolik' });
    }
});

router.post('/demo-shop-orders', async (req, res) => {
    try {
        const { productId, productName, category, price } = req.body || {};
        const order = await addDemoShopOrder(productId, productName, category, price);
        res.json({ ok: true, order });
    } catch (err) {
        console.error('POST /api/state/demo-shop-orders', err);
        res.status(400).json({ error: err.message || 'Xatolik' });
    }
});

router.get('/', authRequired, async (req, res) => {
    try {
        res.json(await getFullState());
    } catch (err) {
        console.error('GET /api/state', err);
        res.status(500).json({ error: 'Ma\'lumotlarni yuklashda xatolik' });
    }
});

router.patch('/', authRequired, async (req, res) => {
    try {
        const body = req.body || {};
        const allowed = [
            'teachers', 'students', 'salesManagers', 'timetable',
            'mainAttendance', 'assistantAttendance', 'payments', 'leads', 'hrEmployees',
            'bookRoadmap', 'mobileContent',
            'scripts', 'bonusHistory', 'bonusData', 'salesPlan', 'cashFlow', 'orgChart', 'manualMetrics',
            'liveGrades', 'demoStudentId', 'studentMessages', 'peerMessages', 'shopOrders'
        ];
        const partial = {};
        allowed.forEach(key => { if (body[key] !== undefined) partial[key] = body[key]; });
        if (!Object.keys(partial).length)
            return res.status(400).json({ error: 'Yangilash uchun ma\'lumot yuborilmadi' });
        await patchState(partial);
        res.json({ ok: true, state: await getFullState() });
    } catch (err) {
        console.error('PATCH /api/state', err);
        res.status(500).json({ error: 'Saqlashda xatolik' });
    }
});

module.exports = router;
