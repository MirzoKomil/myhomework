// Myhomework.uz — avtorizatsiya

document.addEventListener('DOMContentLoaded', () => {
    // Parol ko'z (show/hide) tugmasi
    const eyeBtn = document.getElementById('toggleLoginPassword');
    if (eyeBtn) {
        eyeBtn.addEventListener('click', () => {
            const input = document.getElementById('loginPassword');
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            document.getElementById('eyeIconOpen').style.display = isPassword ? 'none' : '';
            document.getElementById('eyeIconClosed').style.display = isPassword ? '' : 'none';
        });
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    if (!loginForm) return;

    // Boshqa sahifa (masalan, /teacher/) "/?e=xabar" bilan qaytarsa — xabarni ko'rsatamiz.
    const backMsg = mhBackMessage();
    if (backMsg) showError(errorMessage, backMsg);

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!username || !password) return;

        errorMessage.style.display = 'none';
        const btn = document.getElementById('loginBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Kirish...'; }

        try {
            const { res, data } = await mhAuthRequest(username, password);
            if (!res.ok) throw new Error(data.error || "Login yoki parol noto'g'ri!");
            if (!data.token) throw new Error('Xatolik yuz berdi');

            mhSaveSession(data);
            window.location.href = 'index.html';
        } catch (err) {
            showError(errorMessage, err.message || 'Xatolik yuz berdi');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Kirish'; }
        }
    });
});

function showError(el, msg) {
    if (!el) { alert(msg); return; }
    el.style.display = 'block';
    el.innerText = msg;
}

// ── Umumiy kirish yordamchilari (kompyuter formasi va telefon oynalari — js/teamLogin.js — birga ishlatadi) ──
// Server: POST /api/auth/login {email: login, password} → 200 {token,user} · 401 {error, attemptsLeft, failLimit} · 429 {error, locked, retryAfterSec}.
async function mhAuthRequest(login, password) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: login, password })
    });
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    return { res, data };
}

function mhSaveSession(data) {
    localStorage.setItem('mh_token', data.token);
    localStorage.setItem('mh_currentUser', JSON.stringify(data.user));
}

function mhBackMessage() {
    try { return new URLSearchParams(location.search).get('e') || ''; } catch { return ''; }
}
