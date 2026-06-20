// Myhomework.uz — tungi / kunduzgi rejim (barcha sahifalar)

(function applyThemeEarly() {
    if (localStorage.getItem('mh_theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

function getTheme() {
    return localStorage.getItem('mh_theme') || 'light';
}

function setTheme(theme) {
    localStorage.setItem('mh_theme', theme);
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    updateThemeButton();
}

function toggleTheme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isDark = getTheme() === 'dark';
    btn.title = isDark ? 'Kunduzgi rejim' : 'Tungi rejim';
    btn.innerHTML = isDark
        ? `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
        : `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
    btn.classList.toggle('theme-active', isDark);
}

function initTheme() {
    updateThemeButton();
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
