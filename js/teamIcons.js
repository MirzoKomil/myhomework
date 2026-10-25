// Domwork Team — emoji ikonkalarni bir xil chiziqli (line) ikonkalarga almashtirish.
// Faqat UI elementlari (tugma, sarlavha, KPI ikonka, tab, chip) ichida ishlaydi;
// foydalanuvchi yozgan matnga (izoh, chat, yo'riqnoma mazmuni) tegmaydi.
(function () {
    'use strict';
    const P = {
        doc: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
        clip: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>',
        check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
        chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
        warn: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        chat: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
        video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
        refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
        speak: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14"/>',
        grad: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
        trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
        snow: '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9"/>',
        headset: '<path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1v-6h3zM3 19a2 2 0 002 2h1v-6H3z"/>',
        gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 010 5"/>',
        school: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>',
        star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
        calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0M12 17v5"/>',
        users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
        mobile: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
        card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
        rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 6l4 4M9 11a14 14 0 0113-9 14 14 0 01-9 13l-4-4z"/>',
        bag: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/>',
        tool: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
        flag: '<path d="M4 22V4M4 4h12l-2 4 2 4H4"/>',
        lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        megaphone: '<path d="M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1zM17 8a5 5 0 010 8"/>',
        laptop: '<rect x="4" y="4" width="16" height="11" rx="1"/><path d="M2 19h20"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
        trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
        medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 3h7L13 9h-2z"/>',
        folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
        download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
        upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
        printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
        ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0112 0v1"/>',
        save: '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
        food: '<path d="M3 11h18a9 9 0 01-18 0zM12 2v4M8 4v2M16 4v2"/>',
        pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>'
    };
    const MAP = {
        '🎬': 'video', '📚': 'book', '✅': 'check', '📋': 'clip', '📊': 'chart', '✏️': 'edit', '✏': 'edit', '⚠️': 'warn', '⚠': 'warn',
        '💬': 'chat', '📄': 'doc', '💰': 'money', '🎯': 'target', '📝': 'doc', '🖼️': 'image', '🖼': 'image', '🔄': 'refresh', '📖': 'book',
        '🗣️': 'speak', '🗣': 'speak', '🎓': 'grad', '📈': 'trend', '🗑️': 'trash', '🗑': 'trash', '📞': 'phone', '❄️': 'snow', '❄': 'snow',
        '🎧': 'headset', '🎁': 'gift', '🏫': 'school', '📘': 'book', '⭐': 'star', '📅': 'calendar', '🎤': 'mic', '👥': 'users', '📱': 'mobile',
        '💳': 'card', '🚀': 'rocket', '🛍️': 'bag', '🛍': 'bag', '🔊': 'speak', '🛠️': 'tool', '🛠': 'tool', '🏁': 'flag', '🔒': 'lock',
        '📣': 'megaphone', '💻': 'laptop', '💵': 'money', '🔍': 'search', '🏆': 'trophy', '🏅': 'medal', '🥇': 'medal', '🥈': 'medal', '🥉': 'medal',
        '🍽️': 'food', '🍽': 'food', '📁': 'folder', '🚫': 'ban', '🪙': 'money', '📥': 'download', '⬇️': 'download', '⬆️': 'upload',
        '🖨️': 'printer', '🖨': 'printer', '💾': 'save', '👨‍🏫': 'user', '👩‍🏫': 'user', '🧑‍🏫': 'user', '👩': 'user', '👨': 'user', '🧑': 'user',
        '📍': 'pin', '⏱️': 'clock', '⏰': 'clock', '🕒': 'clock', '🎨': 'image', '📦': 'folder', '📌': 'pin', '❤️': 'heart'
    };
    const keys = Object.keys(MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const RX = new RegExp(`^\\s*(${keys.join('|')})\\uFE0F?\\s*`);
    // Faqat shu UI elementlari ichida (foydalanuvchi matni emas).
    const SCOPE = 'button, h1, h2, h3, h4, h5, th, label, summary, .stat-icon, .stat-label, .kpi-lbl, .mac-tab-btn, .section-nav-item, .chip, .badge, [class*="kpi"] > span, [class*="-ic"], [class*="icon"], .card-header, .tm-kpi, .hb-card, .tp-tb-tab, .mac-empty, .dashboard-empty, .text-muted, .empty-state';
    const SKIP = 'textarea, input, [contenteditable], .chat, [class*="chat-"], .lead-card-comment, .guide-body, .guide-content, .rich-text, .msg, .message';
    const svg = name => `<svg class="team-ico" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;

    function swap(root) {
        root.querySelectorAll(SCOPE).forEach(el => {
            if (el.closest(SKIP) || el.dataset.teamIco) return;
            const first = [...el.childNodes].find(n => n.nodeType === 3 ? n.textContent.trim() : n.nodeType === 1);
            if (!first || first.nodeType !== 3) return;
            const m = RX.exec(first.textContent);
            if (!m) return;
            el.dataset.teamIco = '1';
            const name = MAP[m[1]] || MAP[m[1].replace('️', '')];
            first.textContent = first.textContent.slice(m[0].length);
            const span = document.createElement('span');
            span.className = 'team-ico-wrap';
            span.innerHTML = svg(name);
            // Faqat ikonka bo'lgan qutichalarda (.stat-icon) matn qolmaydi
            el.insertBefore(span, first);
        });
    }

    let pending = false;
    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; const area = document.querySelector('.main-area'); if (area) swap(area); swap(document.getElementById('modalContainer') || document.createElement('div')); });
    }
    function init() {
        schedule();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.teamIcons = { swap };
}());
