'use strict';
const bcrypt = require('bcryptjs');
const policy = require('./policy');
const store = require('./store');
const groups = require('../domworkGroups');
const trial = require('../../../js/trialWorkflow');
const money = value => new Intl.NumberFormat('uz-UZ').format(Number(value) || 0).replace(/[\u00a0\u202f]/g, ' ') + ' UZS';
const text = value => String(value ?? '').slice(0, 200);
const empty = 'Hozircha ma’lumot yo‘q.';
function keyboard(identity) {
    const buttons = policy.menu(identity).map(([, label]) => ({ text: label }));
    const rows = []; for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    return { keyboard: rows, resize_keyboard: true };
}
function chunks(value, max = 3500) {
    const parts = []; let pending = String(value || empty);
    while (pending.length > max) {
        let at = pending.lastIndexOf('\n', max); if (at < 1) at = max;
        parts.push(pending.slice(0, at)); pending = pending.slice(at).replace(/^\n/, '');
    }
    parts.push(pending); return parts;
}
function actionFor(identity, value) { return policy.menu(identity).find(([, label]) => label === value)?.[0]; }
function createHandler({ crm }) {
    if (!crm) throw Error('CRM adapter required');
    return async function handle(db, update) {
        if (update.my_chat_member) {
            const change = update.my_chat_member;
            if (!['group','supergroup'].includes(change.chat?.type)) return;
            await db.query(`INSERT INTO domwork_bot_seen_chats(chat_id,title,bot_status) VALUES($1,$2,$3)
                ON CONFLICT(chat_id) DO UPDATE SET title=EXCLUDED.title,bot_status=EXCLUDED.bot_status,observed_at=NOW()`,
                [String(change.chat.id), text(change.chat.title), change.new_chat_member?.status || 'unknown']);
            // Membership observation never binds a CRM department or teacher by title.
            if (change.new_chat_member?.status !== 'administrator') {
                await db.query('UPDATE domwork_learning_groups SET verified_at=NULL WHERE chat_id=$1', [String(change.chat.id)]);
                await db.query('UPDATE domwork_bot_groups SET active=false WHERE chat_id=$1', [String(change.chat.id)]);
            }
            return;
        }
        const message = update.message;
        const callback = update.callback_query;
        const sender = policy.telegramId(message?.from?.id || callback?.from?.id);
        if (!sender) return;
        // Group callbacks are handled separately: no private data in group replies.
        if (!message || message.chat?.type !== 'private' || String(message.chat.id) !== sender) {
            if (callback) await store.enqueue(db, { key: `u:${update.update_id}:callback`, targetId: sender,
                method: 'answerCallbackQuery', payload: { callback_query_id: callback.id, text: 'Hozir CRM kabinetidan foydalaning.', show_alert: true } });
            return;
        }
        let identity = await store.identity(db, sender), replyNo = 0;
        async function reply(value, extra = {}) {
            for (const part of chunks(value)) await store.enqueue(db, { key: `u:${update.update_id}:r:${replyNo++}`,
                targetId: sender, role: identity?.role || '', account: identity,
                payload: { chat_id: sender, text: part, ...(identity ? { reply_markup: keyboard(identity) } : {}), ...extra } });
        }
        try {
            if (message.contact) {
                identity = await store.linkContact(db, message);
                return await reply(`Assalomu alaykum, ${text(identity.name)}!\nDomwork shaxsiy kabinetingiz ochildi.`);
            }
            const command = String(message.text || '').trim();
            if (command === '/stop') {
                if (identity) await db.query('UPDATE domwork_bot_links SET paused=true WHERE telegram_id=$1', [sender]);
                return await reply('Avtomatik xabarlar to‘xtatildi. Davom ettirish uchun /start bosing.', { reply_markup: { remove_keyboard: true } });
            }
            if (!identity) return await reply('CRM akkauntingizni aniqlash uchun o‘zingizning telefon raqamingizni yuboring.',
                { reply_markup: { keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
            if (command === '/start' || command === '/menu') {
                await db.query('UPDATE domwork_bot_links SET paused=false WHERE telegram_id=$1', [sender]);
                await store.setSession(db, sender, null);
                return await reply(`Assalomu alaykum, ${text(identity.name)}! Kerakli bo‘limni tanlang.`);
            }
            if (command === '/cancel') {
                await store.setSession(db, sender, null); return await reply('Bekor qilindi.');
            }
            const pending = await store.session(db, sender);
            if (pending?.type === 'leave') {
                policy.requireAction(identity, 'leave');
                const match = /^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+([\s\S]{5,1000})$/.exec(command);
                const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
                if (!match || !validDate(match[1]) || !validDate(match[2]) || match[2] < match[1])
                    return await reply('Sana va sababni shu shaklda yuboring:\n2026-10-12 2026-10-13 Oilaviy sabab\nBekor qilish: /cancel');
                if (!identity.employeeId) throw policy.error(409, 'Faol HR profiliga biriktiring');
                await db.query(`INSERT INTO domwork_bot_leave_requests(id,employee_id,user_id,reason,start_date,end_date)
                    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
                    [`leave:${update.update_id}`,identity.employeeId,identity.id,match[3],match[1],match[2]]);
                await store.audit(db, identity.id, 'leave-request', `leave:${update.update_id}`);
                await store.setSession(db, sender, null);
                return await reply('Ruxsat arizasi administratorga yuborildi. Hali tasdiqlanmagan.');
            }
            const action = actionFor(identity, command);
            if (!action) return await reply('Menyudan bo‘limni tanlang. Bekor qilish: /cancel');
            policy.requireAction(identity, action);
            const config = (await store.settings(db)).data;
            if (action === 'contact') return await reply('Qo‘llab-quvvatlash: https://t.me/domwork_admin');
            if (['course','platform','results'].includes(action)) return await reply(config[action + 'Text'] || 'Materiallar administrator tomonidan hali kiritilmagan. https://t.me/domwork_admin');
            if (action === 'leave') {
                await store.setSession(db, sender, { type: 'leave' });
                return await reply('Boshlanish sanasi, tugash sanasi va sababni kiriting:\n2026-10-12 2026-10-13 Oilaviy sabab\nBekor qilish: /cancel');
            }
            if (action === 'penalties') {
                const rows = (await db.query('SELECT amount,reason,created_at FROM domwork_bot_penalties WHERE employee_id=$1 ORDER BY created_at DESC LIMIT 30', [identity.employeeId || ''])).rows;
                return await reply(rows.map(r => `${money(r.amount)} — ${text(r.reason)}`).join('\n') || empty);
            }
            if (action === 'work') {
                const rows = (await db.query('SELECT kind,occurred_at FROM domwork_bot_face_logs WHERE employee_id=$1 ORDER BY occurred_at DESC LIMIT 30', [identity.employeeId || ''])).rows;
                return await reply(rows.map(r => `${r.kind === 'in' ? 'Keldi' : 'Ketdi'}: ${new Date(r.occurred_at).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}`).join('\n') || 'Face ID manbasi hali ulanmagan. Davomat taxmin qilinmaydi.');
            }
            if (identity.role === 'trial' && action === 'trial-group') {
                const lead = await crm.getLeadById(identity.id);
                if (!lead || lead.language !== 'russian' || lead.status !== 'sinov-darsida') throw policy.error(403, 'Faol sinov darsi topilmadi');
                const booking = trial.request(lead);
                const group = await groups.defaultForTeacher(db, 'trial', booking?.teacherId);
                return await reply(group ? `${text(group.name)}\n${group.inviteLink}` : 'Ustozingiz uchun sinov guruhi hali belgilanmagan. Administrator bilan bog‘laning.');
            }
            if (identity.role === 'student') {
                // Never use demo-student fallback: every adapter receives the verified CRM id.
                if (!identity.id) throw policy.error(403, 'O‘quvchi akkaunti topilmadi');
                if (action === 'credentials') {
                    const row = (await db.query("SELECT phone,extra_data FROM students WHERE id=$1 AND subject='russian'", [identity.id])).rows[0];
                    const last4 = policy.phone(row?.phone).slice(-4);
                    const original = last4.length === 4 && row?.extra_data?.passwordHash && await bcrypt.compare(last4, row.extra_data.passwordHash);
                    return await reply(`Platforma: https://myhomework.uz/student/\nLogin: ${text(row?.extra_data?.login || '+' + policy.phone(row?.phone))}\n`
                        + (original ? `Parol: ${last4}` : 'Parol o‘zgartirilgan. Uni ko‘rsatish yoki tiklash uchun administratorga murojaat qiling.'));
                }
                if (action === 'grades') {
                    const result = await crm.getDemoStudentGrades(identity.id);
                    return await reply((result.grades || []).slice(-30).map(g => `${text(g.date)} — `
                        + (g.scores ? Object.entries(g.scores).map(([key,value])=>`${text(key)}: ${text(value)}`).join(', ') : text(g.overall ?? g.score ?? 'Baholar CRMda'))).join('\n') || empty);
                }
                if (action === 'payments') {
                    const result = await crm.getDemoStudentPayments(identity.id);
                    return await reply(`Tarif: ${text(result.tariffLabel)}\nQoldiq qarz: ${money(result.debtAmount)}\nMuddat: ${text(result.paymentDueDate || 'Belgilanmagan')}\n`
                        + (result.history || []).slice(0,30).map(r => `${text(r.date || r.paidDate)} — ${money(r.amount || r.paid)}`).join('\n'));
                }
                if (action === 'book') {
                    // No name-based best-effort matching: it can expose a namesake's address.
                    const student = (await db.query('SELECT extra_data FROM students WHERE id=$1', [identity.id])).rows[0];
                    const ref = student?.extra_data?.leadRef;
                    const rows = (await db.query("SELECT student_id,lead_ref,status,dispatched_at FROM book_roadmap WHERE lang='russian'", [])).rows;
                    const matches = rows.filter(r => {
                        let lead; try { lead = JSON.parse(r.lead_ref || 'null'); } catch { return false; }
                        return r.student_id === identity.id || (ref?.id && ref.lang === 'russian' && lead?.id === ref.id && lead.lang === 'russian');
                    });
                    const result = matches.length === 1 ? matches[0] : null;
                    return await reply(result ? `Yetkazib berish bosqichi: ${text(result.status)}\nJo‘natilgan sana: ${text(result.dispatched_at)}` : 'Kitob yozuvi akkauntingizga aniq biriktirilmagan. Administrator tekshirsin.');
                }
                if (action === 'attendance') {
                    const rows = (await db.query(`SELECT 'Asosiy' AS duty,LEFT(att_key,7) AS month,day,present FROM main_attendance WHERE student_id=$1
                        UNION ALL SELECT 'Yordamchi',LEFT(att_key,7),day,present FROM assistant_attendance WHERE student_id=$1 ORDER BY month DESC,day DESC LIMIT 60`, [identity.id])).rows;
                    return await reply(rows.map(r => `${r.month}-${String(r.day).padStart(2,'0')} · ${r.duty} · ${r.present === 1 ? 'Qatnashdi' : 'Kelmadi'}`).join('\n') || empty);
                }
                if (action === 'contract') {
                    const row = (await db.query('SELECT extra_data FROM students WHERE id=$1', [identity.id])).rows[0];
                    if (!row?.extra_data?.contract?.number) return await reply('Shartnoma hali rasmiylashtirilmagan. Administrator bilan bog‘laning.');
                    await store.enqueue(db, { key: `u:${update.update_id}:contract`, targetId: sender, role: 'student', account: identity,
                        method: 'sendDocument', payload: { chat_id: sender, _documentStudentId: identity.id } });
                    return;
                }
                if (action === 'groups' || action === 'schedule') {
                    const result = await crm.getDemoStudentSchedule(identity.id);
                    if (action === 'schedule') return await reply(`Dars vaqti: ${text(result.lessonTime || 'Belgilanmagan')}\nKeyingi dars: `
                        + (result.startsAt ? new Date(result.startsAt).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'}) : 'Belgilanmagan'));
                    const student = (await db.query('SELECT teacher_id,extra_data FROM students WHERE id=$1', [identity.id])).rows[0];
                    const group = await groups.defaultForTeacher(db, 'classroom', student?.teacher_id);
                    // The student's historical, explicit group takes priority; never overwrite it.
                    const link = result.telegramGroupLink || group?.inviteLink;
                    return await reply([link ? `Dars guruhi: ${link}` : 'Dars guruhi belgilanmagan.', config.officialChannel ? `Rasmiy kanal: ${config.officialChannel}` : ''].filter(Boolean).join('\n'));
                }
            }
            // Staff integrations are intentionally separate from student/data access.
            if (crm.staffAction) return await reply(await crm.staffAction(db, identity, action));
            return await reply('Bu funksiya hali ulanmagan. Hozircha CRM kabinetidan foydalaning.');
        } catch (error) {
            if (!error.status || error.status >= 500) throw error;
            await reply(error.message);
        }
    };
}
module.exports = { money, keyboard, chunks, actionFor, createHandler };
