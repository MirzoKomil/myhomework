const CRM_URL = 'https://myhomework.uz/api/leads';
const TIMES = new Set(['09:00–12:00', '12:00–16:00', '16:00–20:00']);
const GOALS = {
  domwork: new Set(['Ish va karyera', 'Rossiyada ishlash/yashash', 'Erkin muloqot', 'Sertifikat']),
  homework: new Set(['Ish va karyera', 'Safar / chet elda yashash', 'Erkin muloqot', 'IELTS/CEFR uchun poydevor'])
};
const reply = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
});
function clean(value, max) {
  return typeof value === 'string' ? value.trim().replace(/[\r\n\u0000]/g, ' ').slice(0, max) : '';
}
function trustedOrigins(source, env) {
  const domain = source === 'domwork' ? 'domwork.uz' : 'homeworkuz.uz';
  const origins = new Set(['https://' + domain, 'https://www.' + domain]);
  // These URLs are supplied by Netlify, not by an incoming Host/page field.
  for (const value of [env.URL, env.DEPLOY_URL, env.DEPLOY_PRIME_URL]) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && /(^|\.)netlify\.app$/.test(url.hostname)) origins.add(url.origin);
    } catch { /* unset URL */ }
  }
  if (env.NETLIFY_DEV === 'true') origins.add('http://localhost:8888');
  return origins;
}
export function createHandler(source, { env = process.env, fetcher = (...args) => fetch(...args) } = {}) {
  if (!GOALS[source]) throw new Error('Invalid landing source');
  return async function handler(request) {
    if (request.method !== 'POST') return reply(405, { error: 'Faqat POST so‘rovi qabul qilinadi' }, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (!trustedOrigins(source, env).has(origin)) return reply(403, { error: 'Sayt manzili ruxsat etilmagan' });
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''))
      return reply(415, { error: 'JSON so‘rovi kerak' });
    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 16000) return reply(413, { error: 'So‘rov juda katta' });
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('object required');
    } catch { return reply(400, { error: 'So‘rov noto‘g‘ri' }); }
    if (body['bot-field']) return reply(200, { ok: true, ignored: true });
    // Non-mutating deployment check. The secret stays on Netlify; CRM receives
    // an EMPTY name and must reject before any lead or audit row is inserted.
    const probe = body.probe === true && Object.keys(body).length === 1;
    const name = clean(body.name, 120);
    const phone = clean(body.phone, 40);
    const goal = clean(body.goal, 100), time = clean(body.time, 30);
    const telegram = clean(body.telegram, 100);
    const externalId = clean(body.externalId, 80);
    if (!probe && (name.length < 2 || !/^\+[1-9]\d{6,14}$/.test(phone) || !GOALS[source].has(goal) || !TIMES.has(time)
      || !new RegExp('^' + source + '_[a-f0-9-]{36}$', 'i').test(externalId)))
      return reply(400, { error: 'Ism, telefon, maqsad va qulay vaqtni tekshiring' });
    const secret = String(env.LEADS_WEBHOOK_SECRET || '').trim();
    const configurationIssue = !secret ? 'missing' : secret.includes(',') ? 'multiple_keys'
      : secret === 'myhomework-leads-dev-secret' ? 'legacy_development_key' : '';
    if (configurationIssue)
      return reply(503, { error: 'CRM ulanishi sozlanmagan. Administratorga murojaat qiling',
        ...probe ? {configurationIssue} : {} });
    const payload = {
      name, phone, source, language: source === 'domwork' ? 'russian' : 'english',
      leadType: 'organic', status: 'yangi-lidlar', externalId,
      // The existing CRM endpoint puts this field into the lead's first comment.
      contactTime: time + ' | Maqsad: ' + goal + (telegram ? ' | Telegram: ' + telegram : '') + ' | Sayt: ' + origin
    };
    for (const key of ['utm_source', 'utm_campaign', 'utm_content', 'fbclid']) {
      const value = clean(body[key], key === 'fbclid' ? 500 : 255);
      if (value) payload[key] = value;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher(CRM_URL, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secret,
          'X-Lead-Source': source, Origin: origin },
        body: JSON.stringify(probe ? { name: '' } : payload)
      });
      let result;
      try { result = await response.json(); } catch { /* not a confirmed CRM response */ }
      if (probe) {
        const connected = response.status === 400 && result?.error === 'Ism kiritilishi shart';
        return reply(connected ? 200 : 502, {ok:connected,crmConnected:connected,
          ...connected ? {} : {error:'CRM ulanishi tasdiqlanmadi'}});
      }
      if (!response.ok || result?.ok !== true || typeof result.id !== 'string' || !result.id)
        return reply(response.status === 429 ? 429 : 502, {
          error: response.status === 429 ? 'So‘rovlar ko‘paydi. Bir ozdan keyin qayta yuboring' : 'CRM arizani tasdiqlamadi. Qayta yuborib ko‘ring'
        });
      // No CRM record, credentials or other leads are exposed to this public endpoint.
      return reply(200, { ok: true, id: result.id, duplicate: result.duplicate === true });
    } catch {
      // An uncertain timeout must keep the SAME externalId for a visitor's retry.
      return reply(502, { error: 'Ulanish uzildi. Ma’lumotlaringiz saqlanib turibdi, qayta yuborib ko‘ring' });
    } finally { clearTimeout(timer); }
  };
}
