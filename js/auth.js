// Myhomework.uz — avtorizatsiya va rol tanlash
document.addEventListener('DOMContentLoaded', () => {
    const loginRole = document.getElementById('loginRole');
    const loginProfile = document.getElementById('loginProfile');
    const loginBtn = document.getElementById('loginBtn');
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (!loginRole) return; // Faqat login sahifasida ishlashi uchun

    let availableProfiles = [];

    loginRole.addEventListener('change', () => {
        const role = loginRole.value;
        loginProfile.innerHTML = '<option value="">— Tanlang —</option>';
        availableProfiles = [];
        errorMessage.style.display = 'none';

        if (!role) {
            loginProfile.disabled = true;
            loginBtn.disabled = true;
            return;
        }

        // xodimlarni LocalStorage dan o'qish
        const hrEmps = JSON.parse(localStorage.getItem('mh_hr_employees') || '[]');
        const teachers = JSON.parse(localStorage.getItem('mh_teachers') || '[]');

        if (role === 'Admin') {
            availableProfiles = [{ id: 'admin', name: 'Asosiy Admin', role: 'admin' }];
        } else if (role === 'Sotuv menejeri') {
            availableProfiles = hrEmps.filter(e => e.role === 'Sotuv menejeri' || e.role === 'sotuv_menejeri');
        } else if (role === "O'qituvchi") {
            availableProfiles = teachers.map(t => ({ id: t.id, name: t.name, role: 'teacher' }));
            const hrTeachers = hrEmps.filter(e => e.role === "O'qituvchi" || e.role === "Yordamchi o'qituvchi");
            availableProfiles = [...availableProfiles, ...hrTeachers.map(t => ({ id: t.id, name: t.name, role: 'teacher' }))];
        }

        if (availableProfiles.length === 0) {
            loginProfile.innerHTML = `<option value="">Bu rolga mos foydalanuvchilar yo'q</option>`;
            loginProfile.disabled = true;
            loginBtn.disabled = true;
        } else {
            loginProfile.disabled = false;
            availableProfiles.forEach(p => {
                loginProfile.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            });
        }
    });

    loginProfile.addEventListener('change', () => {
        loginBtn.disabled = !loginProfile.value;
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const roleStr = loginRole.value;
        const profileId = loginProfile.value;

        if (!roleStr || !profileId) return;

        const profile = availableProfiles.find(p => p.id === profileId);
        if (!profile) return;

        // Backend mocksiz: LocalStorage'ga yozamiz
        const user = {
            id: profile.id,
            name: profile.name,
            role: roleStr,
            token: 'mock-token-' + Date.now()
        };

        if (roleStr === "O'qituvchi") user.role = 'teacher';
        if (roleStr === 'Sotuv menejeri') user.role = 'sales_manager';
        if (roleStr === 'Admin') user.role = 'admin';

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
