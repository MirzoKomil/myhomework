# DAVOM ETTIRISH — boshqa Claude akkaunti uchun (2026-11-02 13:40)

## Holat qisqacha
- **ROP desktop kabineti — SAYTDA** (PR #250 merge qilingan). Faqat `rop` roli + ekran >900px (`body.rop-desk-v2`).
- **Sotuv menejeri desktop — dizayn TAYYOR (10 bord, hammasi ≥6.5), kod BOSHLANGAN.**
- Boshqa rollar (ustoz, yordamchi, HR, targetolog) desktopi — keyinga qoldirilgan.

## Qayerda nima bor
- Kod: github.com/MirzoKomil/myhomework
  - `main` — ROP desktop ichida (js/ropDesk/shell.js, leads.js, pages-common.js, pages-nazorat.js, pages-sotuv.js, pages-sms.js; css/ropDesk.css, css/ropDeskPages.css).
  - `feat/sotuv-desktop-a` — 1 commit a73a8da: urinishlar ikki marta sanalmasin (window.staleLeads.attempts, barcha rollar) — TAYYOR, test qilinmagan. Sotuv UI hali yo'q.
  - `feat/sotuv-desktop-b` — WIP, 1 commit 7b5a264: faqat SERVER — edit-request kind `'due'` (sotuv menejeri "Muddatni surish so'rovi" → ROP tasdiqlaydi). UI hali yo'q.
  - `design/desktop-backup` — DIZAYN ZAXIRASI (main'ga merge QILINMAYDI): `boards/` (RopK*, RopKL_*, SotK*.dc.html + canvas.json), `tools/` (generatorlar, renderer), `HANDOFF.md`.
- Dizayn kanvasi (asl): claude.ai Design artefakti, sahifalar "ROP · Kompyuter (B)" va "Sotuv · Kompyuter". Boshqa akkaunt ochishi uchun artefaktni Share orqali ulashish kerak; aks holda `design/desktop-backup` dagi fayllardan foydalaning.
- To'liq tarix/qarorlar: claude/HANDOFF-rop-desktop-dizayn.md, xarita: claude/AUDIT-sotuv-desktop-xarita.md.

## Qoidalar (Abdulloh)
- B yondashuv: mavjud tuzilma qoladi, ko'rinish/funksiya telefon ilovaga moslanadi. Mavjud funksiya YO'QOLMAYDI. Kanban ustunlari o'zgarmaydi. Dars jadvali v3 va Sinov darslari qayta chizilmaydi.
- Baho chegarasi: qolgan sahifalar 6.5 yetarli (mustaqil agent baholaydi, yechim beradi).
- Har bosqichdan keyin HANDOFF yangilanadi. Javob o'zbekcha, qisqa, tayyor variantlar bilan.
- PR'ni Mirzakomil merge qiladi; Claude PR ochadi (gh api orqali: `gh api repos/MirzoKomil/myhomework/pulls -f base=main -f head=<branch> ...`).
- Sotuv menejeri lid qo'sha olmaydi; PATCH /api/state sales_manager'dan hech narsa qabul qilmaydi (shuning uchun skript faqat o'qish, qarz muddati — so'rov).

## Sotuv desktop — qolgan ish (A qismi, feat/sotuv-desktop-a)
1. js/ropDesk/shell.js ikkala rolga: isSot/isDesk, body.sot-desk-v2; sotuv sidebari: Bosh sahifa · Lidlar · Dars jadvali · Sinov darslari · O'quvchilar · Qarzdorlar · Sotuv rejasi · Reyting · Skriptlar, "Boshqa": Statistika · SMS · Kitob yetkazish (badge yo'q); kalitlar → window.sotDeskPages.open(key) (guard bilan, aks holda mavjud tablar). Sarlavha "Sotuv menejeri · Rus tili".
2. ropSotuvNav.js apply/mark: ropDesk.isDesk() bo'lsa desk sidebar (rop va sales_manager).
3. css/ropDesk.css: body.rop-desk-v2 → body:is(.rop-desk-v2,.sot-desk-v2); sotuvga xos — css/sotDesk.css.
4. js/ropDesk/leads.js isDesk() uchun; ROPga xos qismlar isRop() ostida; sotuvda: menejer tugmasi yo'q, "+ Lid qo'shish" yo'q; bo'sh joy bosib belgilash + Shift; bulk "SMS yuborish" (LEAD_SMS_TEMPLATES, apiSendSms(...,'lidlar',{skipAlreadySent:true}), qabul qiluvchi + segment soni).
5. js/sotDesk/call.js: telefon/navbat tugmasi = tel: havola → staleLeads.logCall (2 daq dedupe) → "Qo'ng'iroq qanday o'tdi?" (sotuvApp openCallResult/outcome porti), ichida keyingi qo'ng'iroq vaqti; "KEYINGI QO'NG'IROQ" navbat paneli (callQueue).
6. Qotgan lidlar: desktopda 3 kunlik banner (homeCardHtml matni); 5 kunlik qulfdan qo'ng'iroq → natija oynasi qulf ustida.
7. Bosh (renderManagerHome): navbat kartasi, bugungi plitkalar (qo'ng'iroq/javob/sinov/to'lov jarayonida), qotgan lid banneri.
8. Test: Playwright sales_manager/rop/admin 1440×960, sotuv 800px.

## Sotuv desktop — qolgan ish (B qismi)
1. `js/schoolUI.js` + `js/ropApp.js`: Tasdiqlar'da `'due'` turini ko'rsatish (eski → yangi sana, qarz, izoh/eslatma, "Tasdiqlansa" qatorlari).
2. `js/ropDesk/pages-common.js` ni `sales_manager` uchun kengaytirish: `body.sot-desk-v2`, `window.sotDeskPages = {open(key), activeKey()}`; kalitlar debt, plan, rating, script, funnel, sms (stu, book → mavjud sahifalar). CSS: `:is(body.rop-desk-v2, body.sot-desk-v2)`; faqat sotuvga tegishlisi css/sotDeskPages.css.
3. Qarzdorlar (SotK_Debtors): "Muddatni surish so'rovi" dialogi → POST /api/school/students/:id/edit (reason bilan), 409 xabari, qatorda "Surish so'rovi kutilmoqda".
4. Sotuv rejasi (SotK_Plan), Reyting (SotK_Rating), SMS (SotK_Sms), Statistika (SotK_Funnel), Skript (SotK_Scripts) — dizayn bordlariga 1:1.
5. Test: Postgres test 'due' oqimi; Playwright (sales_manager, rop, admin, 1440×960).

## Ma'lum prod xatolar (hali tuzatilmagan)
- Urinishlar ikki marta sanaladi: sotuvApp.js:198 attemptsOf, staleLeads.js:14 CALL_TYPES (call-attempt + contact-fail) — A qismida tuzatilishi rejalashtirilgan.
- Mobil ropApp.js loadRules xatoda 3/5/30 ga qaytadi.
- Server restoreLead managerId'ni saqlaydi (mobil tozalaydi).
- ROP desktop qolgan: Arxiv yon panel, Reyting qo'shimchalari (15 mln chegarasi, bonus ogohlantirishi), Skript+Yo'riqnoma birlashuvi, lid ichki oynalari (E*, G2, H1, J1) maydon darajasidagi detallar.

## Yangi chatda birinchi xabar (nusxa oling)
"Domwork loyihasi. claude/HANDOFF-DAVOM-ETTIRISH.md ni o'qi. myhomework repo'da feat/sotuv-desktop-a va feat/sotuv-desktop-b branchlaridan davom et: sotuv menejeri desktop kodini tugat (dizayn: design/desktop-backup branch, boards/SotK*.dc.html), bitta PR och. Javoblar o'zbekcha, qisqa."
