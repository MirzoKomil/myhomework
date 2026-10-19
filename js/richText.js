// Uzun matnlar (konspekt, slayd matni, o'qish paragrafi va h.k.) uchun oddiy
// belgilash sintaksisi. Student-app ham AYNAN shu qoidalarni amalga oshiradi —
// shuning uchun bu yerda HTML emas, faqat matnli belgilar saqlanadi:
//   **qalin**  *kursiv*  __tagiga chizilgan__  ==belgilangan==
//   {koʻk}…{/koʻk} {qizil}…{/qizil} {yashil}…{/yashil} {sariq}…{/sariq}
//   "# " bilan boshlangan qator — sarlavha, "- " bilan — ro'yxat bandi.

const RICH_TEXT_COLORS = {
    'koʻk': '#2563eb',
    kok: '#2563eb', // klaviaturada ʻ topilmasa ham ishlashi uchun
    qizil: '#dc2626',
    yashil: '#16a34a',
    sariq: '#ca8a04', // oddiy sariq oq fonda o'qilmaydi — to'qroq tus
};

function _rtEscape(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Bitta qator ichidagi belgilar. Matn AVVAL escape qilinadi, keyin faqat
// biz yaratgan teglar qo'shiladi — matndan xom HTML hech qachon o'tmaydi.
function _rtInline(escaped) {
    let s = escaped;
    s = s.replace(/\{(koʻk|kok|qizil|yashil|sariq)\}([\s\S]*?)\{\/\1\}/g,
        (_, c, inner) => `<span style="color:${RICH_TEXT_COLORS[c]}">${inner}</span>`);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.+?)__/g, '<u>$1</u>');
    s = s.replace(/==(.+?)==/g, '<mark style="background:#fef08a;color:#111827;padding:0 2px;border-radius:3px">$1</mark>');
    // Qalin (**) allaqachon almashtirilgan, shuning uchun bu yerda faqat yakka *.
    s = s.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    return s;
}

// Butun matnni xavfsiz HTML'ga aylantiradi (oldindan ko'rish uchun).
function formatRichText(text) {
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let inList = false;
    const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
    lines.forEach(line => {
        if (/^#\s+/.test(line)) {
            closeList();
            out.push(`<div style="font-weight:800;font-size:16px;margin:10px 0 4px">${_rtInline(_rtEscape(line.replace(/^#\s+/, '')))}</div>`);
        } else if (/^-\s+/.test(line)) {
            if (!inList) { out.push('<ul style="margin:4px 0;padding-left:20px">'); inList = true; }
            out.push(`<li>${_rtInline(_rtEscape(line.replace(/^-\s+/, '')))}</li>`);
        } else if (!line.trim()) {
            closeList();
            out.push('<div style="height:8px"></div>');
        } else {
            closeList();
            out.push(`<div>${_rtInline(_rtEscape(line))}</div>`);
        }
    });
    closeList();
    return out.join('');
}

// ─── Brauzer qismi: textarea ustidagi formatlash paneli ──────────────────────
const _RT_BTN_STYLE = 'min-width:30px;height:28px;padding:0 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px';

function richTextToolbarHtml(textareaId) {
    const id = escapeAttrRt(textareaId);
    return `<div class="rt-toolbar" data-rt-for="${id}" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;align-items:center">
        <button type="button" data-rt="bold" title="Qalin" style="${_RT_BTN_STYLE};font-weight:800">B</button>
        <button type="button" data-rt="italic" title="Kursiv" style="${_RT_BTN_STYLE};font-style:italic;font-family:serif">I</button>
        <button type="button" data-rt="underline" title="Tagiga chizish" style="${_RT_BTN_STYLE};text-decoration:underline">U</button>
        <button type="button" data-rt="highlight" title="Belgilash (sariq fon)" style="${_RT_BTN_STYLE};background:#fef08a;color:#111827">▌</button>
        <select data-rt="color" title="Matn rangi" style="height:28px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;padding:0 4px">
            <option value="">Rang ▾</option>
            <option value="koʻk" style="color:#2563eb">Koʻk</option>
            <option value="qizil" style="color:#dc2626">Qizil</option>
            <option value="yashil" style="color:#16a34a">Yashil</option>
            <option value="sariq" style="color:#ca8a04">Sariq</option>
        </select>
        <button type="button" data-rt="heading" title="Sarlavha" style="${_RT_BTN_STYLE};font-weight:700">H</button>
        <button type="button" data-rt="bullet" title="Roʻyxat bandi" style="${_RT_BTN_STYLE}">•</button>
    </div>`;
}

function escapeAttrRt(s) { return _rtEscape(s); }

// Belgilangan matnni o'raydi; hech narsa belgilanmagan bo'lsa namuna so'z
// qo'yib, uni belgilab beradi — admin darhol ustidan yoza oladi.
function _rtWrap(ta, before, after, placeholder) {
    const start = ta.selectionStart, end = ta.selectionEnd;
    const v = ta.value;
    const sel = v.slice(start, end) || placeholder;
    ta.value = v.slice(0, start) + before + sel + after + v.slice(end);
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + sel.length);
}

// Sarlavha/ro'yxat butun qatorga tegishli — belgilangan har bir qator boshiga
// prefiks qo'yiladi (yoki allaqachon bo'lsa olib tashlanadi).
function _rtPrefixLines(ta, prefix) {
    const v = ta.value;
    const lineStart = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let lineEnd = v.indexOf('\n', Math.max(ta.selectionEnd - (ta.selectionEnd > ta.selectionStart ? 1 : 0), ta.selectionStart));
    if (lineEnd === -1) lineEnd = v.length;
    const block = v.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const allHave = lines.every(l => l.startsWith(prefix));
    const next = lines.map(l => allHave ? l.slice(prefix.length) : (l.startsWith(prefix) ? l : prefix + l)).join('\n');
    ta.value = v.slice(0, lineStart) + next + v.slice(lineEnd);
    ta.focus();
    ta.setSelectionRange(lineStart, lineStart + next.length);
}

function attachRichTextToolbar(textarea, previewEl) {
    if (!textarea) return;
    const bar = textarea.parentElement && textarea.parentElement.querySelector(`.rt-toolbar[data-rt-for="${textarea.id}"]`);
    const refresh = () => { if (previewEl) previewEl.innerHTML = formatRichText(textarea.value) || '<span style="color:var(--text-muted)">Matn kiritilmagan</span>'; };
    // input hodisasi yuboriladi — boshqa tinglovchilar (masalan oldindan
    // ko'rish) qo'lda yozilgandek yangilanishi uchun.
    const changed = () => textarea.dispatchEvent(new Event('input', { bubbles: true }));
    if (bar) {
        // mousedown'da fokus textarea'dan ketmasin — aks holda belgilash yo'qoladi.
        bar.querySelectorAll('button[data-rt]').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
        bar.addEventListener('click', e => {
            const b = e.target.closest('button[data-rt]');
            if (!b) return;
            const kind = b.dataset.rt;
            if (kind === 'bold') _rtWrap(textarea, '**', '**', 'qalin matn');
            else if (kind === 'italic') _rtWrap(textarea, '*', '*', 'kursiv matn');
            else if (kind === 'underline') _rtWrap(textarea, '__', '__', 'matn');
            else if (kind === 'highlight') _rtWrap(textarea, '==', '==', 'muhim joy');
            else if (kind === 'heading') _rtPrefixLines(textarea, '# ');
            else if (kind === 'bullet') _rtPrefixLines(textarea, '- ');
            changed();
        });
        const colorSel = bar.querySelector('select[data-rt="color"]');
        colorSel.addEventListener('change', () => {
            const c = colorSel.value;
            colorSel.value = '';
            if (!c) return;
            _rtWrap(textarea, `{${c}}`, `{/${c}}`, 'matn');
            changed();
        });
    }
    textarea.addEventListener('input', refresh);
    refresh();
}

if (typeof module === 'object' && module.exports) {
    module.exports = { formatRichText, RICH_TEXT_COLORS };
}
