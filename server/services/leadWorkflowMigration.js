// The caller supplies a transaction: original records and their audit snapshots
// either both commit or both roll back. No SMS, account reset or CAPI calls.
async function migrateMergedLeadStage(client, toLead = row => row) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('merge-lead-information-stage-v3'))");
    const { rows } = await client.query("SELECT * FROM leads WHERE status = 'malumot-berildi' AND deleted_at IS NULL ORDER BY id FOR UPDATE");
    for (const before of rows) {
        const updated = await client.query('UPDATE leads SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
            [before.id, 'boglanildi']);
        await client.query(`INSERT INTO lead_audit (lead_id, action, actor_id, actor_name, snapshot)
            VALUES ($1,$2,$3,$4,$5)`, [before.id, 'stage-merged', 'system', 'CRM bosqichlarini birlashtirish',
            JSON.stringify({ before: toLead(before), beforeRow: before, after: toLead(updated.rows[0]), migration: 'merge-information-into-connected-v3' })]);
    }
    return rows.length;
}
module.exports = { migrateMergedLeadStage };
