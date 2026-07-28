/**
 * domwork.netlify.app — mavjud inline <script> blokining TO'LIQ o'rniga
 * qo'yiladigan tuzatilgan versiyasi.
 *
 * Bu saytda (homeworkuz.uz'dan farqli o'laroq) forma to'g'ri validatsiyadan
 * o'tib, https://t.me/homeworkeng_bot ga yo'naltiradi — lekin forma
 * ma'lumotlari (ism, telefon, qulay vaqt, maqsad) hech qayerga
 * yuborilmasdi, faqat tashlab yuborilardi. Endi shu ma'lumotlar CRM'ning
 * tayyor /api/leads webhookiga yuboriladi — Sotuv bo'limining
 * "Yangi lidlar" ustuniga avtomatik tushadi (til = rus tili).
 *
 * DIQQAT: bu sayt hozircha domwork.netlify.app manzilida joylashgan, hali
 * domwork.uz manziliga ko'chirilmagan — shu sabab CRM'ning domen orqali
 * avtomatik til aniqlash mexanizmi (Referer'da "domwork.uz" qidiradi) bu
 * yerda ishlamaydi. Shu sabab source/language pastda ANIQ ko'rsatilgan —
 * sayt domwork.uz'ga ko'chirilgandan keyin ham bu qatorlarni o'chirishning
 * hojati yo'q (baribir to'g'ri ishlayveradi).
 *
 * DIQQAT 2: sahifada Telegram botiga havola "t.me/homeworkeng_bot" —
 * bu xuddi homeworkuz.uz saytidagi bilan BIR XIL bot. Agar bu ataylab
 * qilingan bo'lmasa (ya'ni rus tili yo'nalishi uchun alohida bot bo'lishi
 * kerak bo'lsa), buni tekshirib ko'ring — men bu havolani o'zgartirmadim,
 * chunki bu CRM integratsiyasiga aloqasi yo'q va noto'g'ri taxmin qilishni
 * xohlamadim.
 *
 * O'RNATISH: sahifadagi eski <script>...</script> blokini shu fayl
 * kontenti bilan TO'LIQ almashtiring (yoki shu faylni alohida
 * <script src="domwork-fix.js"></script> sifatida ulang).
 *
 * DIQQAT — WEBHOOK_SECRET: pastdagi qiymat serverdagi standart (dev)
 * qiymat. Agar Railway'da LEADS_WEBHOOK_SECRET boshqa qiymatga
 * o'rnatilgan bo'lsa, shu yerdagi qiymatni ham o'sha bilan almashtiring
 * — aks holda so'rov 401 xatosi bilan qaytadi (forma o'zi baribir
 * ishlayveradi, faqat CRM'ga tushmaydi).
 */

const CRM_API_URL = 'https://myhomework.uz/api/leads';
const CRM_WEBHOOK_SECRET = 'myhomework-leads-dev-secret'; // Railway'dagi haqiqiy qiymat bilan tekshiring

document.querySelectorAll('.opt').forEach(o => {
  o.addEventListener('click', () => {
    const g = o.dataset.g;
    document.querySelectorAll(`.opt[data-g="${g}"]`).forEach(x => x.classList.remove('on'));
    o.classList.add('on');
    o.querySelector('input').checked = true;
    const fid = o.closest('.fg').id;
    document.getElementById(fid).classList.remove('e');
    document.getElementById('e' + fid.slice(1)).classList.remove('show');
  });
});

document.getElementById('inp-phone').addEventListener('input', function () {
  let v = this.value.replace(/\D/g, '').slice(0, 9);
  let f = '';
  if (v.length > 0) f = v.slice(0, 2);
  if (v.length > 2) f += '-' + v.slice(2, 5);
  if (v.length > 5) f += '-' + v.slice(5, 7);
  if (v.length > 7) f += '-' + v.slice(7, 9);
  this.value = f;
});

function se(fid, eid, show) {
  document.getElementById(fid).classList.toggle('e', show);
  document.getElementById(eid).classList.toggle('show', show);
}

document.getElementById('submit-btn').addEventListener('click', () => {
  let ok = true;
  const nm = document.getElementById('inp-name').value.trim();
  if (nm.length < 2) { se('f1', 'e1', true); ok = false; } else { se('f1', 'e1', false); }
  const ph = document.getElementById('inp-phone').value.replace(/\D/g, '');
  if (ph.length < 9) { se('f2', 'e2', true); ok = false; } else { se('f2', 'e2', false); }
  const timeInput = document.querySelector('input[name="time"]:checked');
  if (!timeInput) { document.getElementById('e4').classList.add('show'); ok = false; } else document.getElementById('e4').classList.remove('show');
  const goalInput = document.querySelector('input[name="goal"]:checked');
  if (!goalInput) { document.getElementById('e5').classList.add('show'); ok = false; } else document.getElementById('e5').classList.remove('show');

  if (ok) {
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 0.8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Telegramga yo\'naltirilmoqda...</span>';

    const countryCode = document.getElementById('country-code').value;
    const timeLabel = timeInput.closest('label').querySelector('.opt-label')?.textContent.trim() || timeInput.value;
    const goalLabel = goalInput.closest('label').querySelector('.opt-label')?.textContent.trim() || goalInput.value;
    const noteText = `Qulay vaqt: ${timeLabel} | Maqsad: ${goalLabel}`;

    // CRM'ning Sotuv > Yangi lidlar ustuniga yuboriladi (til: rus tili).
    fetch(CRM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CRM_WEBHOOK_SECRET,
        'X-Lead-Source': 'domwork',
      },
      body: JSON.stringify({
        name: nm,
        phone: countryCode + ph,
        source: 'domwork',
        language: 'russian',
        contactTime: noteText,
        leadType: 'organic',
        externalId: 'domwork_' + Date.now(),
      }),
    }).catch(err => console.error('Lid CRM-ga yuborilmadi:', err));

    setTimeout(() => { window.location.href = 'https://t.me/homeworkeng_bot'; }, 700);
  }
});
