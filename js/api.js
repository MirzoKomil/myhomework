// Myhomework.uz — API client

const TOKEN_KEY = 'mh_token';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('mh_currentUser', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('mh_currentUser');
}

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(path, { ...options, headers });
    let data = {};
    try {
        data = await res.json();
    } catch {
        data = {};
    }
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

async function apiLogin(email, password) {
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    setSession(data.token, data.user);
    return data.user;
}

async function apiRegister(payload) {
    return apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

async function apiLoadState() {
    return apiFetch('/api/state');
}

async function apiPatchState(partial) {
    return apiFetch('/api/state', {
        method: 'PATCH',
        body: JSON.stringify(partial)
    });
}

async function apiFetchLeads() {
    return apiFetch('/api/leads');
}

async function apiHealth() {
    return apiFetch('/api/health');
}

async function apiMe() {
    const data = await apiFetch('/api/auth/me');
    if (data.user) setSession(getToken(), data.user);
    return data.user;
}

async function apiUpdateProfile(payload) {
    const data = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
    });
    if (data.user) setSession(getToken(), data.user);
    return data.user;
}

async function apiChangePassword(currentPassword, newPassword) {
    return apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
    });
}
