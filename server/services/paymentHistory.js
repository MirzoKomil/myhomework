const ledger = require('../../js/paymentLedger');

// A receipt is shown once. Unresolved old academic rows stay in a separate
// archive, never guessed to be new cash or added to the receipt total.
async function forStudent(db, student) {
    const receipts = (await db.query(`SELECT id,source_key,amount,method,receipt_url,tariff,debt_snapshot,legacy_review,
        TO_CHAR(paid_date,'YYYY-MM-DD') AS date,
        TO_CHAR(paid_at AT TIME ZONE 'Asia/Tashkent','HH24:MI') AS time
        FROM payment_records WHERE student_id=$1 OR
        (student_id IS NULL AND lead_id=$2 AND language=$3)
        ORDER BY paid_date DESC,created_at DESC,id`, [student.id, student.leadRef?.id || null, student.subject || 'english'])).rows;
    const migrated = new Set(receipts.map(r => r.source_key));
    const old = (await db.query('SELECT * FROM payments WHERE student_id=$1 ORDER BY date DESC,id', [student.id])).rows;
    const history = receipts.map(r => ({ id: r.id, date: r.date, time: r.time || '',
        amount: Number(r.amount), paid: Number(r.amount), debt: Number(r.debt_snapshot),
        method: r.method, receiptUrl: ledger.receipt(r.receipt_url), legacyReview: r.legacy_review,
        tariffLabel: ledger.TARIFFS[r.tariff] || String(student.tariff || 'Standard'), source: 'ledger' }));
    const legacyHistory = old.filter(r => !migrated.has('academic:' + r.id)).map(r => ({
        id: r.id, date: r.date || '', paid: r.paid, debt: r.debt, platform: r.platform || 0, book: r.book || 0,
        legacyReview: true, source: 'archive' }));
    return { history, legacyHistory, summary: { amount: history.reduce((sum, r) => sum + r.paid, 0),
        count: history.length, debt: ledger.money(student.debtAmount), openingPaid: ledger.money(student.paymentLedgerOpeningPaid) || 0 } };
}
module.exports = { forStudent };
