// Jadval qoidalari (JadvalQoidalar dizayni 1:1) — to'liq sahifa (ekranni to'liq qoplaydi), "Dars jadvali" → "Qoidalar".
// Matn dizayndan aynan ko'chirilgan. Faqat ko'rish uchun: ma'lumot o'qilmaydi va yozilmaydi.
(function () {
    'use strict';
    const BODY = `
<p class="jq-lead" id="jqLead">Bitta manba (server), bitta ko'rinish tili. Har rol o'z vakolatidagini ko'radi va qiladi. Hamma vaqtlar Asia/Tashkent bo'yicha.</p>

<div class="jq-g2">
<section class="jq-card">
<h2>Kim nima ko'radi va qiladi</h2>
<div class="jq-tw"><table class="jq-mx">
<thead><tr><th></th><th>Admin</th><th>ROP</th><th>Sotuv menejeri</th><th>Ustoz</th><th>Yordamchi</th></tr></thead>
<tbody>
<tr><th>Barcha ustozlar jadvali</th><td class="y">✓</td><td class="y">✓</td><td class="p">faqat bo'sh/band</td><td class="n">—</td><td class="n">—</td></tr>
<tr><th>O'quvchi ismlari jadvalda</th><td class="y">✓</td><td class="y">✓</td><td class="n">"band"</td><td class="p">o'ziniki</td><td class="p">o'ziniki</td></tr>
<tr><th>Bugungi holat (o'tildi / qoldirildi)</th><td class="y">✓</td><td class="y">✓</td><td class="n">—</td><td class="p">o'ziniki</td><td class="p">o'ziniki</td></tr>
<tr><th>Sinov darsini band qilish</th><td class="y">✓</td><td class="y">✓</td><td class="y">✓ ochiq vaqtga</td><td class="n">—</td><td class="n">—</td></tr>
<tr><th>Ustoz biriktirish (bo'sh vaqt yo'q bo'lsa)</th><td class="y">✓</td><td class="y">✓</td><td class="n">so'rov</td><td class="n">—</td><td class="n">—</td></tr>
<tr><th>Ish vaqti shabloni</th><td class="y">✓</td><td class="n">—</td><td class="n">—</td><td class="n">so'rov</td><td class="n">so'rov</td></tr>
<tr><th>Sanaga ochish / yopish</th><td class="y">✓</td><td class="p">sinovdan yopish</td><td class="n">—</td><td class="n">so'rov</td><td class="n">so'rov</td></tr>
<tr><th>Qoplash darsi qo'yish</th><td class="y">✓</td><td class="n">—</td><td class="n">—</td><td class="y">✓ (tekshiruvda)</td><td class="n">— (qoplanmaydi)</td></tr>
<tr><th>Sinov tasdig'i va natijasi</th><td class="p">ko'radi</td><td class="p">ko'radi</td><td class="p">ko'radi</td><td class="y">✓</td><td class="n">—</td></tr>
<tr><th>To'lov ma'lumotlari</th><td class="y">✓</td><td class="y">✓</td><td class="y">✓</td><td class="n">hech qachon</td><td class="n">hech qachon</td></tr>
</tbody></table></div>
</section>

<section class="jq-card">
<h2>Vaqt holatlari</h2>
<ul class="jq-st">
<li><i class="jq-sq" style="background:repeating-linear-gradient(135deg,#F1F4F8 0 6px,#E6EAF2 6px 7px)"></i><b>Ish vaqti emas</b> — shablon yoki admin yopgan</li>
<li><i class="jq-sq" style="background:#F6FEF9;border:1.5px dashed #47CD89"></i><b>Sinovga ochiq</b> — ish vaqti, bo'sh; sotuv band qila oladi</li>
<li><i class="jq-sq" style="background:#F5F9FF;border:1.5px dashed #0065D6"></i><b>Admin ochgan</b> — shablondan tashqari, bitta sana yoki har hafta</li>
<li><i class="jq-sq" style="background:#E6EAF2"></i><b>Sinovga yopiq</b> — tanaffus, seminar, "faqat qoplash uchun"</li>
<li><i class="jq-sq" style="background:#FFFBEB;border:1.5px dashed #F79009"></i><b>Ushlab turilgan</b> — menejer tanlayapti, 10 daqiqa</li>
<li><i class="jq-sq" style="background:#F4EBFF;border:1px solid #B692F6"></i><b>Sinov</b> — tasdiq kutilmoqda → tasdiqlandi → natija</li>
<li><i class="jq-sq" style="background:#EAF3FF;border:1px solid #B2D4FF"></i><b>Dars</b> — o'quvchi jadvali; keldi / kelmadi / belgilanmagan</li>
<li><i class="jq-sq" style="background:#CCF1EE;border:1px solid #0E9384"></i><b>Qoplash</b> — qoldirilgan dars o'rniga, admin tasdiqlaydi</li>
</ul>
</section>
</div>

<div class="jq-g2">
<section class="jq-card">
<h2>Vaqt avtomatik bo'shaydi, qachonki…</h2>
<ol class="jq-rl">
<li>Sinov natijasi yozildi (o'tkazildi / lid kelmadi) — ko'p kunlik sinovning <b>qolgan kunlari ham</b>.</li>
<li>Ustoz sinovni rad etdi yoki menejer bekor qildi — menejerga xabar.</li>
<li>Lid "yo'qotildi" yoki o'quvchiga aylandi — lid band qilgan vaqt o'chadi, o'quvchi darsi qoladi.</li>
<li>O'quvchi chiqib ketdi yoki kursi tugadi — vaqt ochiladi. Muzlatilganda vaqt saqlanadi va faqat sinovlarga beriladi.</li>
<li>Ushlab turish 10 daqiqada saqlanmadi.</li>
<li>Ustoz ta'tilga chiqdi (HR) — o'sha kunlar ish vaqtidan chiqadi, darslar "qoplash kerak" bo'ladi.</li>
</ol>
</section>
<section class="jq-card">
<h2>To'qnashuvdan himoya</h2>
<ol class="jq-rl">
<li>Band qilish <b>serverda</b> tekshiriladi: bir ustozda ustma-ust tushadigan ikki faol yozuv bo'lishi mumkin emas (exclusion constraint).</li>
<li>Tanlangan vaqt 10 daqiqa ushlab turiladi; boshqa menejerga "tanlanmoqda" ko'rinadi.</li>
<li>2–3 kunlik sinovda <b>hamma kunlar</b> tekshiriladi, birortasi band bo'lsa — taklif boshqa vaqt.</li>
<li>Jadval har o'zgarishda hammada yangilanadi (eskirgan keshga qarab band qilinmaydi).</li>
<li>Ish vaqti qisqartirilsa — o'sha vaqtdagi darslar ro'yxati ko'rsatiladi, tasdiqsiz saqlanmaydi.</li>
<li>Har o'zgarish tarixga yoziladi: kim, qachon, nima, sabab.</li>
</ol>
</section>
</div>


<section class="jq-card">
<h2>Yagona O'quvchi kartasi — kim nimani ko'radi va tahrirlaydi</h2>
<div class="jq-tw"><table class="jq-mx"><thead><tr><th></th><th>Admin</th><th>ROP</th><th>Sotuv menejeri</th><th>Ustoz</th><th>Yordamchi</th></tr></thead><tbody>
<tr><th>Umumiy (jadval, ustoz, kurs)</th><td class="y">✓</td><td class="y">✓</td><td class="p">o'zi sotganlar</td><td class="p">o'z o'quvchilari</td><td class="p">biriktirilganlar</td></tr>
<tr><th>Asosiy ustoz davomati</th><td class="y">✓</td><td class="y">✓</td><td class="p">o'zi sotganlar</td><td class="y">✓ belgilaydi</td><td class="p">o'qish</td></tr>
<tr><th>Yordamchi aloqalari (usul, daqiqa)</th><td class="y">✓</td><td class="y">✓</td><td class="p">o'zi sotganlar</td><td class="p">o'qish</td><td class="y">✓ belgilaydi</td></tr>
<tr><th>O'zlashtirish (ilova)</th><td class="y">✓</td><td class="p">o'qish</td><td class="p">o'qish</td><td class="y">✓</td><td class="y">✓</td></tr>
<tr><th>To'lovlar, qarz, tarif summasi</th><td class="y">✓</td><td class="y">✓</td><td class="p">o'zi sotganlar</td><td class="n">hech qachon</td><td class="n">hech qachon</td></tr>
<tr><th>Telefon raqamini ko'rish</th><td class="y">✓</td><td class="y">✓</td><td class="p">o'zi sotganlar</td><td class="y">✓</td><td class="p">yashirin · ☎ tugmasi</td></tr>
<tr><th>Ism, telefon, login, parol</th><td class="y">tahrir</td><td class="y">tahrir</td><td class="p">o'zi sotgan · tuzatadi</td><td class="n">—</td><td class="n">—</td></tr>
<tr><th>Ustoz, kun/vaqt, tarif</th><td class="y">tahrir</td><td class="y">tahrir</td><td class="p">o'zi sotgan · faqat bo'sh vaqt</td><td class="p">so'rov</td><td class="n">—</td></tr>
<tr><th>To'lovni tuzatish</th><td class="y">sabab bilan</td><td class="y">sabab bilan</td><td class="p">24 soatgacha · keyin admin tasdig'i</td><td class="n">hech qachon</td><td class="n">hech qachon</td></tr>
<tr><th>Muzlatish, chiqarish, chegirma</th><td class="y">✓</td><td class="y">✓</td><td class="p">so'rov</td><td class="p">so'rov</td><td class="n">—</td></tr>
<tr><th>Telegram guruh (nom, havola)</th><td class="y">tahrir</td><td class="y">tahrir</td><td class="p">kiritadi (o'zi sotgan)</td><td class="p">ochadi</td><td class="p">ochadi</td></tr>
<tr><th>O'zgarishlar tarixi</th><td class="y">✓</td><td class="y">✓</td><td class="p">o'zi sotganlar</td><td class="n">—</td><td class="n">—</td></tr>
</tbody></table></div>
</section>
<section class="jq-card">
<h2>Avatar — bitta manba</h2>
<div class="jq-code">O'quvchi: student app avatari (o'z rasmi yoki ilovadagi 10 ta hayvon personajidan biri (standart — tulki)) → CRM'ning hamma ro'yxati, kartasi, jadvali. Harf (initsial) ishlatilmaydi.
Xodim: o'z rasmi | 60 personajdan tanlash (36 ayol, 36 erkak) | avtomatik → CRM, xodimlar chati, student app (ustoz/yordamchi ko'rinadigan joylar).
users.avatar = {kind: photo | preset | auto, preset_id, url} · students.avatar xuddi shunday · o'zgarsa hamma joyda darhol.</div>
</section>
<section class="jq-card">
<h2>Ma'lumot modeli (kod uchun)</h2>
<div class="jq-code">teacher_availability(teacher_id, weekday, starts_at, ends_at)  — haftalik shablon
availability_override(teacher_id, starts_at, ends_at, kind: open | close | makeup_only | leave, reason, created_by)
booking(id, teacher_id, starts_at, ends_at, kind: lesson | trial | makeup, student_id | lead_id, status, hold_until, created_by)
  EXCLUDE USING gist (teacher_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE status IN (hold, pending, confirmed)
  status: hold → pending → confirmed → done | no_show | cancelled · hold_until = now() + 10 min
assist_contacts(student_id, assistant_id, at, channel: phone | zoom | meet | tg_video | tg_group | tg_text | no_answer, minutes, note)
  hisob: minutes ≥ 5 · kuniga 1 · haftasiga tg_text ≤ 1 · oyiga ≤ 13 · shu kuni kiritiladi, keyin admin
  tavsiya: asosiy dars kunlari oralig'i (Se·Pa·Sh → Du·Ch·Ju) + o'quvchining qulay vaqti · booking emas, jadvalni band qilmaydi
student_groups(student_id, tg_link, name UNIQUE, name_source: manual | auto, members_ok[]) · lid → o'quvchi bosqichida majburiy; eski guruhlarga avtomatik nom
users.avatar / students.avatar(kind, preset_id, url)
student_status(student_id, status: active | frozen | stopped | transferred | finished, from, to, reason, actor) · qayta tiklash: muzlatishni muddatidan oldin tugatish yoki to'xtatilganni qaytarish (vaqt band bo'lsa yangi vaqt) · muzlatish: kursda 1 marta ≤ 30 kun, vaqt faqat sinovlarga ochiladi va o'quvchi uchun saqlanadi, to'lov va kurs oxiri suriladi, muddat tugaganda avtomatik faol · to'xtatish: vaqt bo'shaydi, guruh arxiv, ilova faqat o'tganlar · faol emaslar ustoz/yordamchi/sotuvda alohida, hisobotlarga qo'shilmaydi
student_audit(student_id, field, old, new, reason, actor, role, at, status: applied | pending_admin)
  students — yagona manba: ilova, ustoz, yordamchi, sotuv, ROP, moliya shu yozuvni o'qiydi
lesson_makeups(student_id, teacher_id, missed_date, held_date, kind: separate | double, status: review | approved | rejected)</div>
</section>`;
    let last = null;
    function close() {
        const el = document.getElementById('jqPage');
        if (!el) return;
        el.remove();
        document.documentElement.classList.remove('jq-open');
        document.removeEventListener('keydown', onKey);
        last?.focus?.();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function open() {
        close();
        last = document.activeElement;
        const el = document.createElement('div');
        el.id = 'jqPage';
        el.className = 'jq';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'jqTitle');
        el.innerHTML = `<div class="jq-doc"><div class="jq-top"><h1 id="jqTitle">Yagona dars jadvali — qoidalar</h1>
            <button type="button" class="jq-x" data-jq-close aria-label="Qoidalarni yopish"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Yopish</button></div>${BODY}</div>`;
        document.body.appendChild(el);
        document.documentElement.classList.add('jq-open');
        el.querySelector('[data-jq-close]').onclick = close;
        document.addEventListener('keydown', onKey);
        el.querySelector('[data-jq-close]').focus();
    }
    window.jadvalQoidalar = { open, close };
})();
