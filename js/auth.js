// Myhomework.uz — avtorizatsiya (login/parol orqali)

const HR_EMPLOYEES_KEY = 'mh_hr_employees';

// Admin uchun default hisob (har doim mavjud)
const ADMIN_ACCOUNT = {
    id: 'admin',
    name: 'Asosiy Admin',
    role: 'admin',
    login: 'admin',
    password: 'admin123'
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (!loginForm) return;

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) return;

        errorMessage.style.display = 'none';

        // 1) Admin tekshirish
        if (username === ADMIN_ACCOUNT.login && password === ADMIN_ACCOUNT.password) {
            const user = {
                id: ADMIN_ACCOUNT.id,
                name: ADMIN_ACCOUNT.name,
                role: 'admin',
                token: 'mock-token-' + Date.now()
            };
            localStorage.setItem('mh_currentUser', JSON.stringify(user));
            localStorage.setItem('mh_token', user.token);
            window.location.href = 'index.html';
            return;
        }

        // 2) HR xodimlar orasidan qidirish
        let hrEmps = [];
        try {
            hrEmps = JSON.parse(localStorage.getItem(HR_EMPLOYEES_KEY) || '[]');
        } catch { hrEmps = []; }

        const emp = hrEmps.find(e => e.login === username && e.password === password);

        if (!emp) {
            showError(errorMessage, 'Login yoki parol noto\'g\'ri!');
            return;
        }

        if (emp.status === 'inactive') {
            showError(errorMessage, 'Sizning hisobingiz faol emas. Admin bilan bog\'laning.');
            return;
        }

        // Rolni aniqlash
        let userRole = 'employee';
        const role = emp.role;
        if (role === 'rop' || role === 'Admin') {
            userRole = 'admin';
        } else if (role === 'sotuv-menejeri' || role === 'Sotuv menejeri' || role === 'sotuv_menejeri') {
            userRole = 'sales_manager';
        } else if (role === 'oqituvchi' || role === "O'qituvchi") {
            userRole = 'teacher';
        } else if (role === 'yordamchi' || role === "Yordamchi o'qituvchi") {
            userRole = 'teacher';
        }

        const user = {
            id: emp.id,
            name: emp.name,
            role: userRole,
            token: 'mock-token-' + Date.now()
        };

        localStorage.setItem('mh_currentUser', JSON.stringify(user));
        localStorage.setItem('mh_token', user.token);
        window.location.href = 'index.html';
    });
});

function showError(el, msg) {
    if (!el) { alert(msg); return; }
    el.style.display = 'block';
    el.innerText = msg;
}
