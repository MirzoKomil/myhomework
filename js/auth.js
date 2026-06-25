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

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!username || !password) return;

        errorMessage.style.display = 'none';
        const btn = document.getElementById('loginBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Kirish...'; }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login yoki parol noto'g'ri!");

            localStorage.setItem('mh_token', data.token);
            localStorage.setItem('mh_currentUser', JSON.stringify(data.user));
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
