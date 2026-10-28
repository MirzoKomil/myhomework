// Xodimlarga avtomatik avatar: o'z rasmini yoki personajini qo'ymagan har bir xodimga
// jinsiga mos (f = ayol, m = erkak) bo'sh 3D personaj tasodifiy beriladi. Personaj ikki
// xodimda takrorlanmaydi (school.js PUT /me/avatar bilan bir xil qoida). Xodim keyin
// Profil → Avatar'dan o'zi almashtira oladi; bu yerda faqat bo'sh avatar to'ldiriladi.
const PRESETS = set => Array.from({ length: 36 }, (_, i) => `/images/staff-avatars/${set}${String(i + 1).padStart(2, '0')}.webp`);
const STAFF_ROLES = ['admin', 'boshliq', 'rop', 'sales_manager', 'teacher', 'hr', 'moliya', 'targetolog', 'employee', 'marketing'];

// Jins: HR'dagi "gender" maydoni; bo'lmasa familiya qo'shimchasi (…ova/…eva — ayol, …ov/…ev — erkak);
// bo'lmasa ism (o'zbek ismlarining keng tarqalgan ayol/erkak oxirlari). Aniqlab bo'lmasa — null.
function guessGender(name, hrGender) {
    const g = String(hrGender || '').toLowerCase();
    if (/^(ayol|female|f|woman|женский|ж)$/.test(g)) return 'f';
    if (/^(erkak|male|m|man|мужской|м)$/.test(g)) return 'm';
    const words = String(name || '').trim().toLowerCase().replace(/[‘’ʻʼ`']/g, '').split(/\s+/).filter(Boolean);
    for (const w of words.slice(1).concat(words.slice(0, 1))) {
        if (/(ova|eva|yeva|ayeva|ina|kaya|ская|ова|ева|ина)$/.test(w)) return 'f';
        if (/(ov|ev|yev|in|ский|ов|ев|ин)$/.test(w)) return 'm';
    }
    const first = words[0] || '';
    if (/(bek|jon|bek|ali|ullo|ulloh|lloh|mir|mad|med|rod|bur|shod|zod|xon)$/.test(first) && !/(oy|xon)$/.test(first)) return 'm';
    if (/(a|oy|nur|gul|niso|bonu|xonim|zoda|ra|na)$/.test(first)) return 'f';
    return null;
}

async function assignMissing(pool) {
    const client = await pool.connect();
    const assigned = [];
    try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('school:avatars'))");
        const { rows } = await client.query(`SELECT u.id, u.name, u.role, he.gender FROM users u
            LEFT JOIN hr_employees he ON LOWER(TRIM(he.login)) = LOWER(TRIM(u.email))
            WHERE COALESCE(u.avatar,'') = '' AND u.role = ANY($1)`, [STAFF_ROLES]);
        if (rows.length) {
            const taken = new Set((await client.query("SELECT avatar FROM users WHERE avatar LIKE '/images/staff-avatars/%'")).rows.map(r => r.avatar));
            for (const u of rows) {
                const g = guessGender(u.name, u.gender);
                if (!g) continue;
                const free = PRESETS(g).filter(p => !taken.has(p));
                if (!free.length) continue;
                const pick = free[Math.floor(Math.random() * free.length)];
                await client.query("UPDATE users SET avatar=$2 WHERE id=$1 AND COALESCE(avatar,'')=''", [u.id, pick]);
                taken.add(pick);
                assigned.push({ name: u.name, avatar: pick });
            }
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally { client.release(); }
    if (assigned.length) console.log(`[avatars] ${assigned.length} ta xodimga avtomatik avatar qo'yildi`);
    return assigned;
}

module.exports = { assignMissing, guessGender, STAFF_ROLES };
