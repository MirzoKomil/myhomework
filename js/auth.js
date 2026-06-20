// Myhomework.uz — autentifikatsiya (API)

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirm')?.value;
        const role = document.getElementById('regRole')?.value || 'admin';
        const errorDiv = document.getElementById('registerError');
        const btn = registerForm.querySelector('button[type="submit"]');

        if (password.length < 6) {
            showError(errorDiv, 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak.');
            return;
        }
        if (confirm !== undefined && password !== confirm) {
            showError(errorDiv, 'Parollar mos kelmadi.');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Kutilmoqda...';
        try {
            await apiRegister({ name, email, password, role });
            alert('Muvaffaqiyatli ro\'yxatdan o\'tdingiz! Endi tizimga kiring.');
            window.location.href = 'login.html';
        } catch (err) {
            showError(errorDiv, err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Ro\'yxatdan o\'tish';
        }
    });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('errorMessage');
        const btn = loginForm.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Kirish...';
        try {
            await apiLogin(email, password);
            window.location.href = 'index.html';
        } catch (err) {
            showError(errorDiv, err.message || 'Xato! Login yoki parol noto\'g\'ri.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Kirish';
        }
    });
}

function showError(el, msg) {
    if (!el) { alert(msg); return; }
    el.style.display = 'block';
    el.innerText = msg;
}
