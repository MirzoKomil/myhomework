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

    const timeoutMs = options.timeout || 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
        res = await fetch(path, { ...options, headers, signal: controller.signal });
    } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('So\'rov vaqti tugadi. Internet aloqasini tekshiring.');
        throw e;
    }
    clearTimeout(timer);

    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

async function apiUploadAvatar(dataUrl) {
    return apiFetch('/api/auth/avatar', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
        timeout: 30000
    });
}

async function apiUploadAvatarForUser(userLogin, dataUrl) {
    return apiFetch(`/api/auth/avatar-for/${encodeURIComponent(userLogin)}`, {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
        timeout: 30000
    });
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

async function apiCreateHrUser(data) {
    return apiFetch('/api/auth/create-user', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function apiGetSessions() {
    return apiFetch('/api/auth/sessions');
}

async function apiDeleteSession(id) {
    return apiFetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
}

async function apiDeleteOtherSessions() {
    return apiFetch('/api/auth/sessions/others', { method: 'DELETE' });
}

async function apiLogout() {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
    clearSession();
}

async function apiUploadFile(file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { 'Authorization': 'Bearer ' + token } : {},
        body: formData
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Yuklash xatoligi' }));
        throw new Error(err.error || 'Yuklash xatoligi');
    }
    return res.json();
}

async function apiDeleteUpload(filename) {
    return apiFetch('/api/upload/' + encodeURIComponent(filename), { method: 'DELETE' });
}

async function apiFetchCommunity() {
    return apiFetch('/api/state/community');
}

async function apiDeleteCommunityPost(postId) {
    return apiFetch('/api/state/community/posts/' + encodeURIComponent(postId), { method: 'DELETE' });
}

async function apiDeleteCommunityComment(postId, commentId) {
    return apiFetch('/api/state/community/posts/' + encodeURIComponent(postId) + '/comments/' + encodeURIComponent(commentId), { method: 'DELETE' });
}
