/**
 * Domwork / Homework → Myhomework.uz admin panel
 *
 * Til qoidasi (server ham shunday qo'llaydi):
 * - Domwork  → rus tili
 * - Homework → ingliz tili
 */
(function (global) {
    const config = {
        apiUrl: 'http://localhost:3000/api/leads',
        secret: 'myhomework-leads-dev-secret',
        source: 'domwork'
    };

    function languageForSource(source, fallback) {
        const s = String(source || '').toLowerCase();
        if (s.includes('domwork')) return 'russian';
        if (s.includes('homework')) return 'english';
        return fallback || 'english';
    }

    function configure(opts) {
        Object.assign(config, opts || {});
    }

    async function sendLead(data) {
        const source = data.source || config.source;
        const payload = {
            name: data.name || data.fullName || data.ism,
            phone: data.phone || data.tel || data.telefon || '',
            language: languageForSource(source, data.language || data.lang || data.til),
            source,
            externalId: data.externalId || data.external_id || data.id || null,
            date: data.date
        };

        const res = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': config.secret,
                'X-Lead-Source': payload.source
            },
            body: JSON.stringify(payload)
        });

        let body = {};
        try {
            body = await res.json();
        } catch {
            body = {};
        }

        if (!res.ok) {
            const err = new Error(body.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return body;
    }

    global.MyhomeworkLeads = { configure, sendLead, languageForSource, config };
})(typeof window !== 'undefined' ? window : global);
