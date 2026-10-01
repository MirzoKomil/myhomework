const { sanitizeMobileContent } = require('../../js/mobileContentPolicy');

// Caller provides a transaction. Row lock prevents a concurrent admin save
// from being lost; backup and narrow cleanup either both commit or both roll back.
async function migrateMobileContentPolicy(client) {
    const { rows } = await client.query('SELECT data FROM mobile_content WHERE singleton = 1 FOR UPDATE');
    if (!rows.length) return false;
    const before = JSON.stringify(rows[0].data);
    const cleaned = sanitizeMobileContent(JSON.parse(before));
    const after = JSON.stringify(cleaned);
    if (before === after) return false;
    await client.query('INSERT INTO mobile_content_backups (reason, data) VALUES ($1, $2)',
        ['remove-unrelated-video-and-pronunciation-2026-10-01', before]);
    await client.query('UPDATE mobile_content SET data = $1 WHERE singleton = 1', [after]);
    return true;
}

module.exports = { migrateMobileContentPolicy };
