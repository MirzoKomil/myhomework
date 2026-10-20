const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('kanban renders a limited page per column with a "show more" button', () => {
    assert.ok(app.includes('const LEAD_COLUMN_PAGE = 40;'));
    assert.ok(app.includes('items.slice(0, limit)'));
    assert.ok(app.includes('data-col-more='));
    assert.ok(app.includes('<span class="lead-column-count" style="color:${col.count}">${items.length}</span>'), 'count shows the full column');
});

test('read notifications are parsed once per board render', () => {
    assert.ok(app.includes('const readIds = _leadRenderReadIds || new Set('));
    assert.ok(app.includes('} finally { _leadRenderReadIds = null; }'));
});
