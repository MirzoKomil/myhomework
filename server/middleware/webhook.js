const LEADS_WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || 'myhomework-leads-dev-secret';

function webhookSecretRequired(req, res, next) {
    const header = req.headers['x-webhook-secret'] || '';
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (header === LEADS_WEBHOOK_SECRET || bearer === LEADS_WEBHOOK_SECRET) {
        return next();
    }
    return res.status(401).json({ error: 'Webhook kaliti noto\'g\'ri' });
}

module.exports = { webhookSecretRequired, LEADS_WEBHOOK_SECRET };
