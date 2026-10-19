// Darsga biriktirilgan audio dialoglar (darslikdagi trek + qatorma-qator
// ruscha matn va o'zbekcha tarjima). Saqlanish joyi:
//   mc.lessonContents[lessonId].audioDialogs = [{ id, title, audioUrl,
//     coverUrl?, bookPart?, trackNo?, durationSec?, lines:[{speaker, ru, uz, start?}] }]
// Student-app shu shaklni o'qiydi — maydon nomlarini o'zgartirmang.

// "[0:05]", "[1:02.5]", "[1:02:03]" → soniya. Noto'g'ri bo'lsa null.
function parseDialogTime(str) {
    const m = /^(?:(\d+):)?(\d{1,3}):(\d{1,2}(?:\.\d+)?)$/.exec(String(str || '').trim());
    if (!m) return null;
    return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
}

function formatDialogTime(sec) {
    if (typeof sec !== 'number' || !isFinite(sec) || sec < 0) return '';
    const whole = Math.floor(sec);
    const frac = Math.round((sec - whole) * 10) / 10;
    const h = Math.floor(whole / 3600), mi = Math.floor((whole % 3600) / 60), s = whole % 60;
    const ss = String(s).padStart(2, '0') + (frac ? String(frac).slice(1) : '');
    return h ? `${h}:${String(mi).padStart(2, '0')}:${ss}` : `${mi}:${ss}`;
}

const _AD_SPEAKER_RE = /^(?:\[([0-9:.]+)\]\s*)?([^:\[\]]{1,40}?):\s*(.+)$/;
const _AD_TIME_ONLY_RE = /^\[([0-9:.]+)\]/;

// Admin joylashtirgan matnni qatorlarga ajratadi. Format:
//   [0:05] Mehmon: ruscha gap      ← vaqt ixtiyoriy
//   o'zbekcha tarjima              ← keyingi qator har doim tarjima
// Tarjima qatorida ":" bo'lishi mumkin, shuning uchun qatorlar navbatma-navbat
// o'qiladi (so'zlovchi qatori → tarjima), faqat vaqt bilan boshlangan qator
// har doim yangi replika hisoblanadi.
function parseDialogText(text) {
    const rows = String(text || '').replace(/\r\n?/g, '\n').split('\n')
        .map((raw, i) => ({ raw: raw.trim(), no: i + 1 }))
        .filter(r => r.raw);
    const lines = [];
    const warnings = [];
    let cur = null;
    const push = () => {
        if (!cur) return;
        if (!cur.uz) warnings.push(`${cur._no}-qator: tarjima (keyingi qator) yoʻq`);
        const line = { speaker: cur.speaker, ru: cur.ru, uz: cur.uz };
        if (cur.start !== null && cur.start !== undefined) line.start = cur.start;
        lines.push(line);
        cur = null;
    };
    rows.forEach(r => {
        const startsWithTime = _AD_TIME_ONLY_RE.test(r.raw);
        if (cur && !startsWithTime) {
            cur.uz = r.raw;
            push();
            return;
        }
        push();
        const m = _AD_SPEAKER_RE.exec(r.raw);
        if (!m) {
            warnings.push(`${r.no}-qator: «Ism: matn» koʻrinishida emas`);
            cur = { speaker: '', ru: r.raw, uz: '', start: null, _no: r.no };
            return;
        }
        let start = null;
        if (m[1] !== undefined) {
            start = parseDialogTime(m[1]);
            if (start === null) warnings.push(`${r.no}-qator: vaqt notoʻgʻri (${m[1]})`);
        }
        cur = { speaker: m[2].trim(), ru: m[3].trim(), uz: '', start, _no: r.no };
    });
    push();
    return { lines, warnings };
}

// Saqlangan qatorlarni qayta tahrirlash uchun yana matn ko'rinishiga qaytaradi.
function serializeDialogLines(lines) {
    return (lines || []).map(l => {
        const t = typeof l.start === 'number' ? `[${formatDialogTime(l.start)}] ` : '';
        return `${t}${l.speaker || ''}: ${l.ru || ''}\n${l.uz || ''}`;
    }).join('\n\n');
}

if (typeof module === 'object' && module.exports) {
    module.exports = { parseDialogText, serializeDialogLines, parseDialogTime, formatDialogTime };
}

// ─── Brauzer qismi (CRM, dars tahrirlovchisi) ────────────────────────────────
// Quyidagi funksiyalar app.js'dagi escapeHtml/openModal/apiUploadFile/
// showMiniToast/_saveLessonWorkingContent'dan chaqiruv paytida foydalanadi.

// Faqat https: CRM/ilova sahifasi https'da, CSP (mediaSrc) esa http audioni bloklaydi.
function _adIsValidAudioUrl(url) {
    return /^\/uploads\/\S+$/.test(url) || /^https:\/\/\S+$/i.test(url);
}

function _renderLcAudioDialogs(body, lesson, content) {
    const dialogs = Array.isArray(content.audioDialogs) ? content.audioDialogs : [];
    const persist = (next) => {
        content.audioDialogs = next;
        _saveLessonWorkingContent(lesson, content);
        showMiniToast('Saqlandi');
        _renderLcAudioDialogs(body, lesson, content);
    };

    const rows = dialogs.length ? dialogs.map((d, i) => {
        const meta = [
            d.bookPart ? `${d.bookPart}-qism` : '',
            d.trackNo ? `Trek ${d.trackNo}` : '',
            d.durationSec ? formatDialogTime(d.durationSec) : '',
            `${(d.lines || []).length} ta replika`,
        ].filter(Boolean).join(' · ');
        return `<div data-ad-row="${i}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--surface)">
            ${d.coverUrl
                ? `<img src="${escapeHtml(d.coverUrl)}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid var(--border)">`
                : `<div style="width:44px;height:44px;border-radius:6px;flex-shrink:0;background:var(--bg,#f9fafb);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px">🎧</div>`}
            <div style="flex:1;min-width:0;font-size:13px;line-height:1.5">
                <div style="font-weight:700;color:var(--text)">${escapeHtml(d.title || '')}</div>
                <div style="color:var(--text-muted);font-size:12px">${escapeHtml(meta)}</div>
            </div>
            <button type="button" data-ad-up="${i}" title="Yuqoriga" class="btn-ghost" style="font-size:12px;padding:4px 8px"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" data-ad-down="${i}" title="Pastga" class="btn-ghost" style="font-size:12px;padding:4px 8px"${i === dialogs.length - 1 ? ' disabled' : ''}>↓</button>
            <button type="button" data-ad-edit="${i}" style="background:none;border:none;cursor:pointer;color:var(--purple,#7c3aed);font-size:12px;font-weight:600;flex-shrink:0">Tahrirlash</button>
            <button type="button" data-ad-del="${i}" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:12px;font-weight:600;flex-shrink:0">Oʻchirish</button>
        </div>`;
    }).join('') : `<div class="mac-empty" style="padding:30px 0;text-align:center;color:var(--text-muted)">Hali audio dialog qoʻshilmagan</div>`;

    body.innerHTML = `
        <div style="display:flex;gap:8px;padding:10px 12px;border:1px solid #f59e0b;background:rgba(245,158,11,0.10);border-radius:8px;margin-bottom:14px;font-size:12px;line-height:1.5;color:var(--text)">
            <span style="flex-shrink:0">⚠️</span>
            <span>Yuklangan fayllar server diskida saqlanadi va u hozircha doimiy emas — server qayta ishga tushganda fayl yoʻqolishi mumkin. Asl fayllarni albatta saqlab qoʻying. Tashqi joyga joylangan audio havolasini qoʻyish xavfsizroq.</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap">
            <div style="font-weight:700;font-size:14px;color:var(--text)">Audio dialoglar</div>
            <button type="button" id="adAddBtn" class="btn-primary-sm">+ Dialog qoʻshish</button>
        </div>
        <div id="adRows">${rows}</div>`;

    document.getElementById('adAddBtn').addEventListener('click', () => _openAudioDialogModal(dialogs, undefined, persist));
    body.querySelectorAll('[data-ad-edit]').forEach(b => b.addEventListener('click', () => _openAudioDialogModal(dialogs, Number(b.dataset.adEdit), persist)));
    body.querySelectorAll('[data-ad-del]').forEach(b => b.addEventListener('click', () => {
        if (!confirm('Bu audio dialog oʻchirilsinmi?')) return;
        persist(dialogs.filter((_, i) => i !== Number(b.dataset.adDel)));
    }));
    const move = (from, to) => {
        const next = dialogs.slice();
        const [it] = next.splice(from, 1);
        next.splice(to, 0, it);
        persist(next);
    };
    body.querySelectorAll('[data-ad-up]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.adUp); if (i > 0) move(i, i - 1); }));
    body.querySelectorAll('[data-ad-down]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.adDown); if (i < dialogs.length - 1) move(i, i + 1); }));
}

function _adLinesTableHtml(parsed) {
    if (!parsed.lines.length) return `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Matn joylashtirilgach, ajratilgan qatorlar shu yerda jadval boʻlib chiqadi.</div>`;
    const warn = parsed.warnings.length
        ? `<div style="font-size:12px;color:#b45309;margin-bottom:6px">${parsed.warnings.map(w => '⚠️ ' + escapeHtml(w)).join('<br>')}</div>` : '';
    const td = 'padding:6px 8px;border-bottom:1px solid var(--border);vertical-align:top';
    return `${warn}<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${parsed.lines.length} ta replika ajratildi:</div>
        <div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px">
        <table style="width:100%;border-collapse:collapse;font-size:12px;color:var(--text)">
            <thead><tr style="background:var(--bg,#f9fafb);text-align:left"><th style="${td}">#</th><th style="${td}">Vaqt</th><th style="${td}">Kim</th><th style="${td}">Ruscha</th><th style="${td}">Oʻzbekcha</th></tr></thead>
            <tbody>${parsed.lines.map((l, i) => `<tr>
                <td style="${td};color:var(--text-muted)">${i + 1}</td>
                <td style="${td};white-space:nowrap">${typeof l.start === 'number' ? formatDialogTime(l.start) : '—'}</td>
                <td style="${td};font-weight:600${l.speaker ? '' : ';color:#ef4444'}">${escapeHtml(l.speaker || '?')}</td>
                <td style="${td}">${escapeHtml(l.ru)}</td>
                <td style="${td}${l.uz ? '' : ';color:#ef4444'}">${l.uz ? escapeHtml(l.uz) : 'yoʻq'}</td>
            </tr>`).join('')}</tbody>
        </table></div>`;
}

function _openAudioDialogModal(dialogs, index, persist) {
    const isEdit = index !== undefined;
    const d = isEdit ? dialogs[index] : {};
    const placeholder = 'Mehmon: Здравствуйте! У вас есть свободный стол?\nAssalomu alaykum! Boʻsh stolingiz bormi?\n[0:05] Ofitsiant: Да, пожалуйста...\nHa, marhamat...';
    openModal(isEdit ? 'Audio dialogni tahrirlash' : 'Audio dialog qoʻshish', `
        <div class="form-group"><label>Sarlavha <span style="color:var(--danger)">*</span></label><input id="adTitle" class="form-control" value="${escapeHtml(d.title || '')}" placeholder="Masalan: Свободный стол"></div>
        <div class="form-group">
            <label>Audio <span style="color:var(--danger)">*</span></label>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <input id="adAudioUrl" class="form-control" style="flex:1;min-width:200px" value="${escapeHtml(d.audioUrl || '')}" placeholder="https://... havolani qoʻying yoki fayl yuklang">
                <input type="file" id="adAudioFile" accept="audio/*" style="display:none">
                <button type="button" id="adAudioUpload" class="btn-ghost" style="font-size:12px">Fayl yuklash</button>
            </div>
            <div id="adAudioPreview" style="margin-top:8px"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
            <div class="form-group"><label>Darslik qismi</label><input id="adBookPart" type="number" min="1" class="form-control" value="${d.bookPart != null ? escapeHtml(String(d.bookPart)) : ''}" placeholder="2"></div>
            <div class="form-group"><label>Trek raqami</label><input id="adTrackNo" type="number" min="1" class="form-control" value="${d.trackNo != null ? escapeHtml(String(d.trackNo)) : ''}" placeholder="14"></div>
            <div class="form-group"><label>Davomiyligi (soniya)</label><input id="adDuration" type="number" min="0" class="form-control" value="${d.durationSec != null ? escapeHtml(String(d.durationSec)) : ''}" placeholder="avtomatik"></div>
        </div>
        <div class="form-group">
            <label>Muqova rasmi (ixtiyoriy)</label>
            <input type="hidden" id="adCoverUrl" value="${escapeHtml(d.coverUrl || '')}">
            <div id="adCoverPreview" style="margin-bottom:6px"></div>
            <input type="file" id="adCoverFile" accept="image/*" style="display:none">
            <button type="button" id="adCoverUpload" class="btn-ghost" style="font-size:12px">Yuklash</button>
            <button type="button" id="adCoverRemove" class="btn-danger-sm" style="font-size:12px">Oʻchirish</button>
        </div>
        <div class="form-group">
            <label>Dialog matni <span style="color:var(--danger)">*</span></label>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Har bir replika 2 qator: <b>«Ism: ruscha gap»</b>, keyingi qatorda <b>oʻzbekcha tarjima</b>. Boshida <b>[0:05]</b> yozilsa — audiodagi boshlanish vaqti.</div>
            <textarea id="adLinesText" class="form-control" rows="9" style="font-family:inherit" placeholder="${escapeHtml(placeholder)}">${escapeHtml(serializeDialogLines(d.lines))}</textarea>
        </div>
        <div id="adLinesTable"></div>`,
        `<button type="button" class="btn-ghost" onclick="closeModal()">Bekor qilish</button><button type="button" class="btn-primary-sm" id="adSave">Saqlash</button>`,
        { wide: true });

    const urlInput = document.getElementById('adAudioUrl');
    const audioPreview = document.getElementById('adAudioPreview');
    const durInput = document.getElementById('adDuration');
    const saveBtn = document.getElementById('adSave');
    let pendingUploads = 0;
    const setBusy = (delta) => {
        pendingUploads += delta;
        saveBtn.disabled = pendingUploads > 0;
        saveBtn.style.opacity = pendingUploads > 0 ? '0.6' : '';
    };

    // Audio o'zgarganda davomiylik qayta hisoblanadi: admin qo'lda kiritgan
    // qiymat faqat shu audio uchun saqlanadi, yangi faylda esa yangilanadi.
    let lastAudioUrl = urlInput.value.trim();
    const renderAudioPreview = () => {
        const url = urlInput.value.trim();
        if (!url) { audioPreview.innerHTML = `<div style="font-size:12px;color:var(--text-muted)">Audio hali tanlanmagan</div>`; return; }
        if (!_adIsValidAudioUrl(url)) { audioPreview.innerHTML = `<div style="font-size:12px;color:#ef4444">Havola https:// bilan boshlanishi kerak</div>`; return; }
        audioPreview.innerHTML = `<audio id="adAudioEl" controls preload="metadata" src="${escapeHtml(url)}" style="width:100%;max-width:420px;height:36px"></audio>`;
        const el = document.getElementById('adAudioEl');
        el.addEventListener('loadedmetadata', () => {
            if (isFinite(el.duration) && el.duration > 0 && (!durInput.value || durInput.dataset.auto === '1')) {
                durInput.value = String(Math.round(el.duration));
                durInput.dataset.auto = '1';
            }
        });
        el.addEventListener('error', () => {
            if (!document.getElementById('adAudioErr')) audioPreview.insertAdjacentHTML('beforeend', `<div id="adAudioErr" style="font-size:12px;color:#ef4444;margin-top:4px">Audio ochilmadi — havolani tekshiring</div>`);
        });
    };
    const onAudioUrlChange = () => {
        const url = urlInput.value.trim();
        if (url === lastAudioUrl) return;
        lastAudioUrl = url;
        durInput.value = '';
        durInput.dataset.auto = '1';
        renderAudioPreview();
    };
    durInput.addEventListener('input', () => { durInput.dataset.auto = ''; });
    urlInput.addEventListener('change', onAudioUrlChange);
    urlInput.addEventListener('paste', () => setTimeout(onAudioUrlChange, 0));
    renderAudioPreview();

    const audioFile = document.getElementById('adAudioFile');
    const audioBtn = document.getElementById('adAudioUpload');
    audioBtn.addEventListener('click', () => audioFile.click());
    audioFile.addEventListener('change', async () => {
        const file = audioFile.files && audioFile.files[0];
        audioFile.value = '';
        if (!file) return;
        setBusy(1);
        audioBtn.disabled = true;
        audioBtn.textContent = 'Yuklanmoqda...';
        try {
            const uploaded = await apiUploadFile(file);
            urlInput.value = uploaded.url;
            onAudioUrlChange();
        } catch (err) {
            alert('Yuklashda xatolik: ' + (err.message || err));
        } finally {
            audioBtn.disabled = false;
            audioBtn.textContent = 'Fayl yuklash';
            setBusy(-1);
        }
    });

    const coverInput = document.getElementById('adCoverUrl');
    const coverPreview = document.getElementById('adCoverPreview');
    const coverBtn = document.getElementById('adCoverUpload');
    const coverRemove = document.getElementById('adCoverRemove');
    const coverFile = document.getElementById('adCoverFile');
    const setCover = (url) => {
        coverInput.value = url || '';
        coverPreview.innerHTML = url
            ? `<img src="${escapeHtml(url)}" style="max-width:120px;max-height:90px;border-radius:8px;border:1px solid var(--border);display:block">`
            : `<div style="font-size:12px;color:var(--text-muted)">Rasm yoʻq</div>`;
        coverBtn.textContent = url ? 'Almashtirish' : 'Yuklash';
        coverRemove.style.display = url ? '' : 'none';
    };
    setCover(coverInput.value);
    coverBtn.addEventListener('click', () => coverFile.click());
    coverRemove.addEventListener('click', () => setCover(''));
    coverFile.addEventListener('change', async () => {
        const file = coverFile.files && coverFile.files[0];
        coverFile.value = '';
        if (!file) return;
        setBusy(1);
        coverBtn.disabled = true;
        coverBtn.textContent = 'Yuklanmoqda...';
        try {
            const uploaded = await apiUploadFile(file);
            setCover(uploaded.url);
        } catch (err) {
            alert('Yuklashda xatolik: ' + (err.message || err));
            setCover(coverInput.value);
        } finally {
            coverBtn.disabled = false;
            setBusy(-1);
        }
    });

    const linesText = document.getElementById('adLinesText');
    const tableEl = document.getElementById('adLinesTable');
    const refreshTable = () => { tableEl.innerHTML = _adLinesTableHtml(parseDialogText(linesText.value)); };
    linesText.addEventListener('input', refreshTable);
    refreshTable();

    saveBtn.addEventListener('click', () => {
        if (pendingUploads > 0) { alert('Fayl hali yuklanmoqda, biroz kuting'); return; }
        const title = document.getElementById('adTitle').value.trim();
        const audioUrl = urlInput.value.trim();
        const parsed = parseDialogText(linesText.value);
        if (!title) { alert('Sarlavhani kiriting'); return; }
        if (!audioUrl) { alert('Audio faylni yuklang yoki havolasini qoʻying'); return; }
        if (!_adIsValidAudioUrl(audioUrl)) { alert('Audio havolasi https:// bilan boshlanishi kerak'); return; }
        if (!parsed.lines.length) { alert('Kamida bitta replika kiriting'); return; }
        if (parsed.lines.some(l => !l.speaker || !l.ru)) { alert('Har bir replikada «Ism: ruscha gap» boʻlishi kerak — jadvaldagi qizil joylarni tuzating'); return; }
        if (parsed.lines.some(l => !l.uz) && !confirm('Baʼzi replikalarda tarjima yoʻq. Shunday saqlansinmi?')) return;

        // Ixtiyoriy maydonlar faqat qiymati bo'lsa yoziladi — student-app
        // "bor/yo'q"ni oddiy tekshiruv bilan aniqlay olishi uchun.
        const next = { id: isEdit && d.id ? d.id : 'ad' + Date.now(), title, audioUrl };
        const coverUrl = coverInput.value.trim();
        if (coverUrl) next.coverUrl = coverUrl;
        const num = (id) => { const v = document.getElementById(id).value.trim(); const n = Number(v); return v !== '' && isFinite(n) && n > 0 ? n : undefined; };
        const bookPart = num('adBookPart'); if (bookPart !== undefined) next.bookPart = Math.round(bookPart);
        const trackNo = num('adTrackNo'); if (trackNo !== undefined) next.trackNo = Math.round(trackNo);
        const durationSec = num('adDuration'); if (durationSec !== undefined) next.durationSec = Math.round(durationSec);
        next.lines = parsed.lines;

        const list = dialogs.slice();
        if (isEdit) list[index] = next; else list.push(next);
        closeModal();
        persist(list);
    });
}
