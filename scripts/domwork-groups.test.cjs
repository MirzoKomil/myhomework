const { test } = require('node:test');
const assert = require('node:assert/strict');
const groups = require('../server/services/domworkGroups');
const body = { name: 'Sinov | Ustoz', type: 'trial', teacherId: 'teacher-a', inviteLink: 'https://t.me/+abcdef123', isDefault: true };
test('normalizes Telegram invites without altering case-sensitive invite hashes', () => {
    assert.equal(groups.inviteLink(' https://t.me/joinchat/AbCdEF_123/ '), 'https://t.me/+AbCdEF_123');
    assert.equal(groups.inviteLink('https://t.me/TeacherGroup'), 'https://t.me/teachergroup');
});
test('rejects unsafe hosts, credentials, query strings, message links and malformed URLs', () => {
    for (const value of ['javascript:alert(1)', 'http://t.me/+abcdef123', 'https://t.me.evil.test/+abcdef123',
        'https://t.me@evil.test/+abcdef123', 'https://x:t@t.me/+abcdef123', 'https://t.me:8443/+abcdef123',
        'https://t.me/+abcdef123?x=1', 'https://t.me/+abcdef123#x', 'https://t.me/channel/123', 'https://t.me/c/123/1', '', null])
        assert.throws(() => groups.inviteLink(value), error => error.status === 400);
});
test('validates teacher, type, default boolean, Russian-only scope and safe group IDs', () => {
    assert.equal(groups.input(body).chatId, '');
    assert.equal(groups.input({ ...body, chatId: '-1001234567890' }).chatId, '-1001234567890');
    for (const patch of [{ type: 'sales' }, { name: '' }, { name: 'x'.repeat(121) }, { teacherId: '' },
        { isDefault: 'true' }, { chatId: '123456789' }, { chatId: '-9007199254740993' }, { language: 'english' }])
        assert.throws(() => groups.input({ ...body, ...patch }), error => error.status === 400);
});
test('requires integer revisions and never exposes unverified IDs as verified', () => {
    for (const value of [undefined, '1', 0, -1, 1.2]) assert.throws(() => groups.revision(value));
    assert.equal(groups.revision(2), 2);
    assert.equal(groups.dto({ chat_id: '-100123', verified_at: null }).botVerified, false);
});
test('persisted CRM role takes precedence over a supplied admin claim', async () => {
    await assert.rejects(groups.admin({ query: async () => ({ rows: [{ id: 'a', role: 'teacher' }] }) }, { id: 'a', role: 'admin' }), error => error.status === 403);
    await assert.rejects(groups.admin({ query: async () => ({ rows: [] }) }, { id: 'missing', role: 'admin' }), error => error.status === 403);
});
