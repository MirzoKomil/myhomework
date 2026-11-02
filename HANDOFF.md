# HANDOFF — ROP kompyuter kabineti (B yondashuv) — 2026-11-02 (tong)

## Qarorlar (Abdulloh)
- Birinchi (RD01–RD10) versiya rad etildi va o'chirildi.
- B yondashuv: hozirgi tuzilma (kanban ustunlari, Dars jadvali v3, tablar, filtrlar, tugmalar) O'ZGARMAYDI; ko'rinish/funksiya telefon bilan tenglashtiriladi.
- QATTIQ QOIDA: mavjud funksiyalar yo'qolmasligi kerak (Zapis, izohlar, sinov oynalari va h.k.). Lidlar ichidagi HAMMA oynalar chiziladi — ro'yxat: claude/AUDIT-lidlar-ichki-oynalar.md (42 ta).
- "Bog'lanishga urinilmoqda" → **"Urinilmoqda"** (kodda LEAD_COLUMNS label: app.js ~14349, ~19215).
- Lidlar: C varianti tanlandi; A/B kanvasdan o'chirildi.
- Lidlar ekrani uchun maqsad: **9.5/10**. Lidlar ichki oynalari: 8/10. **Qolgan bo'limlar va boshqa kabinetlar: 7.0/10 yetarli (Abdulloh, 2-noyabr 12:03).**
- Yosh rangi: **B** — prod shkala hamma ochiq ustunda; Yangi lidlarda ustun darajasida "30+ daq · N" chipi.
- Kartaning bo'sh joyini bosish = belgilash; Shift+bosish/Shift+Space = oraliq.
- **A**: Yangi/Urinilmoqda → Muvaffaqiyatsiz, sabab "Javob bermadi / Ko'tarmadi (6+) / Noto'g'ri raqam" bo'lsa Bog'lanildi anketasi SO'RALMAYDI (prodda hozir so'raladi — kodga o'tkazishda o'zgartirish kerak: startMvCascade/getSkippedSurveySteps).
- Tunda: Abdulloh tasdiqini kutmay davom etish; tartib: Lidlar 9.5 → ichki oynalar (8+) → qolgan ROP sahifalari (8+) → boshqa rollar.

## Kanvas: "Domwork Team — Sotuv ilovasi" → sahifa "ROP · Kompyuter (B)"
- RK01 Bosh sahifa — "Boldi". RK00 Navigatsiya — 8/10, tasdiqlangan.
- **RK02 Lidlar (project/RopKLeadsC.dc.html) — 9.5/10 ✓ (v23 mustaqil agent; v24 da 2 ta oxirgi mayda tuzatish).** Baholar: 7.3 → … → 9.4 (v13) → 9.2 → 9.3 → 9.4 → 9.3 → 9.4 → 9.3 → 9.4 → 9.4 → 9.4 → **9.5 (v23)**.
  - Kodga o'tkazishda saqlanadigan prod mosliklari:
    - Filtrda sarlavha "mos / jami", segment va sabab paneli bir xil son; "Yana N ta (filtr)" 0 gacha kamayadi.
    - Izoh soni karta/sarlavha/tab'da bir xil; "Oxirgi izoh" = eng yangi izoh; bo'sh holatda "Hozircha izoh yoʻq".
    - Izoh faqat MUDDATI O'TGAN eslatmani yopadi (getLeadNextFollowUp); yopilgan bosqichda (paid/fail/junk) eslatma belgisi chiqmaydi; belgi matni "Qoʻngʻiroq · …" / "Qoʻngʻiroq vaqti oʻtdi · …" (formatLeadFollowUpWhen).
    - So'rovnomali har bir bosqich o'tishi prod avtomatik izohini yozadi; izoh belgilari renderLeadCommentItem bo'yicha.
    - Anketa bir marta to'ldirilsa keyingi o'tishlarda qayta so'ralmaydi.
    - Anketa: bitta xato bir vaqtda (daraja → ariza → yosh → jins → hudud → maqsad → ma'lumot), viloyat oldindan tanlanmaydi, daraja prod to'liq matni.
    - Lid qo'shish: telefon ixtiyoriy, Lid turi majburiy, 2-telefon + Izoh saqlanadi, normalizeLeadPhoneInput/formatPhoneDisplay.
    - SMS: LEAD_SMS_TEMPLATES (ism bilan), "Yuborilmoqda...", "SMS yuborilmadi: …". Zapis: yuklash ("Yuklanmoqda...") va o'chirish tasdig'i bilan.
- **RK02.* ichki oynalar (16 bord, RopKL_<kod>.dc.html, y=3200+) — HAMMASI 8+ ✓:** A3, B1, C1, C2, D1, F1, E2, E5, E7a, E1, E3, E10, E10b, G2, H1, J1 — har biri Lidlar komponentining o'zi, kerakli oyna ochiq holatda (scratchpad mkvar.py bilan RopKLeadsC dan yaratiladi — Lidlar o'zgarsa qayta generatsiya qilish kerak). Baholar: o'rtacha 8.6; H1 6.0→8.6, D1 7.0→7.9→8.4, E5 7.6→8.4.
- **RK02.I1–I5 O'quvchiga aylantirish (RopKL_I.dc.html) — 8.2 ✓:** to'liq sahifa, 3 Tarif va jadval → 4 To'lov → 5 Telegram guruh → 6 Ilova login → To'lov yopildi → yakun, o'ngda Xulosa. Baholar 6.6 → 7.5 → 7.8 → 8.2. Prod qoidalari: yopishda pul tushgan bo'lsa (jami > avval to'langan) usul+chek majburiy; 10 000 dan kichik summa tasdig'i; birinchi dars ustoz dars kuniga moslanadi.
- **RK03 Qotib qolgan lidlar qoidasi (RopK_Stale.dc.html) — 8.3 ✓** (7.8 → 8.3): sahifa (prod'da Lidlar'dagi modal), Rus tili qoidasi, kunlar chizig'i, saqlashdan oldingi ko'rinish (qaysi menejer qulflanadi), menejerlar jadvali, saqlanmagan o'zgarish dialogi.
- canvas.json'ni boshqa sessiya ham yozadi — har safar o'qib, merge qilib publish.

## Prod'da topilgan muammo (kodga o'tkazishda)
- GET /api/leads/stale-rule DB xatosida 200 + DEFAULT qaytaradi, client loadRules xatoni yutadi → ROP sahifasida xato holati ko'rinmaydi va saqlash haqiqiy qoidani 3/5/30 ga almashtirib yuborishi mumkin. GET 5xx qaytarsin, ROP sahifasida loadRules(true) xato tashlasin; saqlashdan keyin serverning javobidagi (cleanRule) qiymatlar olinsin.
- convertUI 5-qadam "Orqaga" amalda 3-qadamga qaytmaydi (openPaymentTeacherScheduleModal saqlangan jadvalda keyingi qadamga o'tib ketadi) — `{ edit: true }` kabi variant kerak.
- convertUI'dagi status izohlari (3/4-qadam) prod mantiqiga zid: status 6-qadamda "Toʻlov jarayonida", yopishda "Toʻlov yopildi" bo'ladi.

## Keyingi qadam
1. Qolgan ROP sahifalari B usulida (Voronka, Sinov nazorati, SLA, Reyting, Qarzdorlar, Skript, SMS, O'quvchilar, Tasdiqlar, Telegram guruh), har biri 8+.
2. Keyin boshqa rollar (sotuv menejeri, ustoz, yordamchi, HR, targetolog) kompyuter kabinetlari → kod (role-scoped, 1:1, PR).

## Qolgan ROP sahifalari — baholar (maqsad 7.0; 02.11 12:28 dan egasi: 6.5 ham yetarli)
- SLA (RopK_Sla) — 7.8 ✓
- Tasdiqlar (RopK_Approvals) — 8.2 ✓. Ochiq: A1 Moliya qatori sanaga bog'liq bo'lsin + Qarzdorlarga havola; A2 qaror bloki tekshiruvni pastga surib yuboradi; A4 "Oldin" qiymati audit(request_id)dan, yaxshisi createRequest'da before snapshot.
- Qarzdorlar (RopK_Debtors) — 7.4 ✓. Ochiq: D1 tarif nomlari 15/30/60 (Start/Standart/VIP) bo'lsin, tahrir oynasidan tarif olib tashlansin (audit chetlab o'tiladi); D2 PROD: inflow.receive frozen:false yozadi — muzlatish buziladi; D3 qarz aniqlanmagan qatorda to'lov o'chirilsin; D4 muddat surilganda sabab+tarix; D5 PROD: openDebtorEditModal paid/debt'ni qayta yozadi (stale-write).
- Voronka (RopK_Funnel) — 7.6 ✓. Ochiq: "eng katta yo'qotish" biriktirilmagan backlogni hisoblaydi (faqat bosqichdan chiqqanlar sanalsin); yangi qismlar Dizayn farqi bilan belgilansin; jadvaldagi "Tushum" → "Shartnoma summasi".
- Reyting (RopK_Rating) — 7.2 ✓. Ochiq: Ustozlar oyi RATING_START=2026-10 dan oldinga o'tmasin; ▲/▼ oldingi oy qatorlaridan hisoblansin; haftalik 15 mln chegarasi ko'rsatilsin; bonus oynasida shart/takror ogohlantirishi.
- Sotuv rejasi, Skript, SMS, Arxiv — qurilmoqda
- O'quvchilar, Telegram guruh — qayta chizilmaydi (AdminGuruhlar va boshqalar bor)
- Sotuv rejasi (RopK_Plan) — 7.6 ✓ (tuzatishlar ketmoqda: fakt lid 13, pace bo'yicha rang). PROD bug: lockPlan renderSalesPlanIndividualPlanCard'ni o'ramaydi → oy almashtirilsa ROPda ✏️ qaytadi, saqlash 403.
- Skript va yo'riqnoma (RopK_Scripts) — 6.8 ✓ (6.5 chegara) — tuzatildi, joylandi v220 (prod muharrir tugmalari B/I/U/☰/🎨/😊/⟲ qaytariladi, HTML kontent).
- SMS (RopK_Sms) 7.3 ✓, Arxiv (RopK_Archive) 7.6 ✓ — tuzatildi va joylandi v221 (SMS timeout: server yuborishda davom etadi → "yuborilgan bo'lishi mumkin", qayta yuborish yo'q; arxivda o'ylab topilgan sabablar olib tashlanadi). Eslatma: server restoreLead managerId'ni saqlaydi, mobil esa tozalaydi — serverga ko'chirish tavsiya.
- Keyingi: sotuv menejeri desktop kabineti xaritasi tayyorlanmoqda.
- Sotuv menejeri desktop: xarita claude/AUDIT-sotuv-desktop-xarita.md. Qurilmoqda: SotKLeads, SotKL_Call, SotKL_Stale (agent 1); SotKHome, SotK_Debtors/Rating/Funnel/Plan/Scripts/Sms (agent 2). Chegara 6.5.

**ROP desktop kabineti YAKUNLANDI (v221).** Keyingisi: sotuv menejeri.

## KOD (2026-11-02 12:48, Abdulloh: A — ROP kodini hozir, alohida PR)
- Boshqa rollar desktopi keyinga qoldirildi (limit). Hozir: ROP kod + sotuv menejeri dizayni tugatiladi.
- Branch A `feat/rop-desktop-a`: shell/sidebar, Bosh sahifa, Lidlar + 16 ichki oyna, convertUI bug'lari, stale-rule 5xx. Yangi fayllar js/ropDesk/shell.js, leads.js, css/ropDesk.css.
- Branch B `feat/rop-desktop-b`: Stale, SLA, Tasdiqlar, Qarzdorlar, Voronka, Reyting, Reja, Skript, SMS, Arxiv (js/ropDesk/pages-*.js) + prod bug'lar (SMS timeout, inflow frozen, debtor stale-write, lockPlan).
- Hammasi faqat `rop` roliga; boshqa rollar o'zgarmaydi. Yakunda A+B birlashtirilib bitta PR, Mirzakomil merge qiladi.

## Sotuv menejeri desktop (kanvas sahifa "sotk" — Sotuv · Kompyuter)
- SK01 Bosh 7.8, SK06 Qarzdorlar 7.3, SK07 Reja 7.2, SK08 Reyting 7.8, SK09 Skript 8.4, SK10 Statistika 8.3, SK11 SMS 7.6 — hammasi ✓ (6.5 chegara), tuzatishlar v223 da joylandi.
- Muhim prod fakti: PATCH /api/state sales_manager'dan hech qanday kalit qabul qilmaydi → skript tahriri va qarz tahriri menejerda saqlanmaydi. Dizaynda: skript faqat o'qish, qarz muddati = "Muddatni surish so'rovi" ROPga.
- Qolgan: SK02 Lidlar (SotKLeads), SK03 Qo'ng'iroq natijasi (SotKL_Call), SK04 Qotgan lidlar qulfi (SotKL_Stale) — qurilmoqda. Kanvasda x=1520..6080 bo'sh joy ular uchun.
- SK02 Lidlar 7.3 ✓, SK03 Qo'ng'iroq natijasi 6.9 ✓, SK04 Qotgan lidlar qulfi 7.8 ✓ — SOTUV MENEJERI DIZAYNI TO'LIQ (10 bord). Tuzatish ketmoqda: yagona seed (27 ochiq/53), "Qo'ng'iroq qildim" o'rniga tel: havola (qo'ng'iroqsiz Sifatsiz chetlab o'tilmasin).
- PROD bug: urinish ikki marta sanaladi (sotuvApp.js:198 attemptsOf, staleLeads.js:14 CALL_TYPES: call-attempt + contact-fail) → "6+ urinish" sabablari erta ochiladi.
- KOD B tayyor (feat/rop-desktop-b, 8 commit, worktree .claude/worktrees/agent-a411556ba8bc4185a): 5 prod bug tuzatildi (SMS timeout + takror yubormaslik serverda, inflow frozen, debtor stale-write + muddat sababi/tarix, lockPlan, qarz aniqlanmagan). 9/10 sahifa; qolgan: Arxiv yon panel, Reyting qo'shimchalar, Skript+yo'riqnoma birlashuvi, Reja format, Voronka filtr qatori. Routing: window.ropDeskPages.open(key).
- **PR #250 MERGE QILINDI (13:25)** (feat/rop-desktop-v2 = A + B merge) ochildi: https://github.com/MirzoKomil/myhomework/pull/250 — Mirzakomil merge qiladi. Real serverda tekshirish: yig'ilgan ustunga drag-drop, convert 5→3→4→6, SMS (Eskiz).
- Keyingi PR: Arxiv yon panel, Reyting qo'shimchalari, Skript+Yo'riqnoma, ichki oynalar detallari; mobil ropApp.loadRules hali 3/5/30 ga qaytadi; urinishlar ikki marta sanalishi (attemptsOf/CALL_TYPES).
- Keyin: sotuv menejeri desktop kodi (dizayn tayyor, sahifa "sotk").
- Sotuv menejeri desktop KOD boshlandi (13:25): A `feat/sotuv-desktop-a` (shell, Bosh, Lidlar, Qo'ng'iroq natijasi + tel: havola, qotgan lidlar, urinishlarni ikki marta sanash tuzatishi), B `feat/sotuv-desktop-b` (Qarzdorlar + muddat surish so'rovi ROP Tasdiqlariga, Reja, Reyting, SMS, Statistika, Skript). Gate: sales_manager + >900px, body.sot-desk-v2.
