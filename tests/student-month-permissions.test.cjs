/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// No real Supabase client or network is loaded by these tests.
function load(file, dependencies = {}, globals = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module: loaded, exports: loaded.exports, Date, console: { error() {} }, ...globals,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: file });
  return loaded.exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const operating = load('lib/operating-month.ts');
const { buildStudentSavePlan } = load('lib/student-account-save-plan.ts');
const responseModule = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } };
const pastRows = [
  { username: 'alice', student_id: 's1', year_month: '2026-09', class_keys: ['800-monwed'], marker: 'keep' },
  ...['2605', '2026-05', '2026-06', '2026-07', '2026-08'].map((month) => ({
    username: 'alice', student_id: 's1', year_month: month, class_keys: ['600-tuthu'],
  })),
];

function setup(options = {}) {
  const state = {
    document: { rows: [...pastRows, { username: 'bob', student_id: 's2', year_month: '2026-10', class_keys: ['800-tuthu'] }], extra: 'keep' },
    writes: [], reads: [], accounts: [{ username: 'alice', student_id: 's1' }, { username: 'bob', student_id: 's2' }],
    conflicts: options.conflicts ?? 0,
    updatedAt: '2026-09-01T00:00:00Z',
  };
  if (options.document) state.document = options.document;
  const client = { from(table) {
    let action = 'select', payload, filters = {};
    const query = {
      select() { return query; }, limit() { return query; },
      eq(key, value) { filters[key] = value; return query; },
      in(key, value) { filters[key] = value; return query; },
      maybeSingle() { return query; },
      update(value) { action = 'update'; payload = value; return query; },
      then(resolve, reject) {
        try {
          if (action === 'update') {
            assert.equal(table, 'site_notices');
            assert.equal(filters.notice_key, 'student_month_permissions');
            assert.equal(filters.updated_at, state.updatedAt, 'compare-and-swap required');
            assert.equal('content_text' in filters, false, 'large JSON must not be sent in the URL');
            assert.deepEqual(Object.keys(payload).sort(), ['content_text', 'updated_at']);
            if (options.writeError) return Promise.resolve({ error: { message: 'write failed' } }).then(resolve, reject);
            if (state.conflicts-- > 0) {
              state.document.rows.push({ username: 'other', year_month: '2026-09', class_keys: ['800-monwed'] });
              state.updatedAt = new Date(Date.parse(state.updatedAt) + 1).toISOString();
              return Promise.resolve({ data: [], error: null }).then(resolve, reject);
            }
            state.writes.push({ table, payload: plain(payload) });
            state.document = JSON.parse(payload.content_text);
            assert.ok(Date.parse(payload.updated_at) > Date.parse(state.updatedAt));
            state.updatedAt = payload.updated_at;
            return Promise.resolve({ data: [{ notice_key: filters.notice_key }], error: null }).then(resolve, reject);
          }
          state.reads.push(table);
          let result;
          if (table === 'student_month_permissions') result = options.tableExists
            ? { data: [], error: null } : { data: null, error: { code: 'PGRST205' } };
          else if (table === 'student_accounts') result = { data: state.accounts.filter((row) => filters.username.includes(row.username)), error: null };
          else if (table === 'site_notices') result = { data: options.missingNotice ? null : {
            content_text: options.invalidJson ? '{broken' : JSON.stringify(state.document), updated_at: state.updatedAt,
          }, error: null };
          else throw new Error(`Unexpected table: ${table}`);
          return Promise.resolve(result).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  } };
  const { POST } = load('app/api/save-student-month-permissions/route.ts', {
    'next/server': responseModule, '../../../lib/supabase-admin': { supabaseAdmin: client },
    '../../../lib/operating-month': operating,
  });
  return { state, client, save: (body) => POST({ json: async () => body }) };
}
const request = (permissions) => ({ yearMonth: '2026-10', permissions });

test('October save preserves all historical rows and fields; only the fallback notice is written', async () => {
  const { state, save, client } = setup();
  const oldRows = plain(state.document.rows);
  const accounts = plain(state.accounts);
  const result = await save(request([{ username: 'alice', classKeys: ['600-monwed'] }]));
  assert.equal(result.status, 200);
  assert.deepEqual(state.document.rows.slice(0, oldRows.length), oldRows);
  assert.equal(state.document.extra, 'keep');
  assert.deepEqual(state.accounts, accounts);
  assert.deepEqual(state.writes.map((write) => write.table), ['site_notices']);
  assert.equal(state.reads.includes('student_class_access_ranges'), false);
  const permissions = load('lib/student-month-permissions.ts', { './supabase-admin': { supabaseAdmin: client } });
  const fetched = await permissions.fetchStudentMonthPermissions();
  assert.equal(fetched.error, null);
  assert.deepEqual(plain(fetched.byUsername.get('alice')['2026-10']), ['600-monwed']);
  assert.deepEqual(plain(fetched.byStudentId.get('s1')['2026-09']), ['800-monwed']);
});

test('Unchecking all classes saves an empty October array without removing the student', async () => {
  const { state, save } = setup();
  assert.equal((await save(request([{ username: 'bob', classKeys: [] }]))).status, 200);
  assert.deepEqual(state.document.rows.find((row) => row.username === 'bob').class_keys, []);
  assert.equal(state.accounts.length, 2);
});

test('Only the requested month changes, including when editing September explicitly', async () => {
  const { state, save } = setup();
  const october = plain(state.document.rows.find((row) => row.year_month === '2026-10'));
  assert.equal((await save({ yearMonth: '2026-09', permissions: [{ username: 'alice', classKeys: [] }] })).status, 200);
  assert.deepEqual(state.document.rows.find((row) => row.year_month === '2026-10'), october);
  assert.equal(state.document.rows.find((row) => row.year_month === '2026-08').class_keys[0], '600-tuthu');
});

test('Concurrent changes trigger a reread and retain the newer historical row', async () => {
  const { state, save } = setup({ conflicts: 1 });
  assert.equal((await save(request([{ username: 'alice', classKeys: ['600-monwed'] }]))).status, 200);
  assert.ok(state.document.rows.some((row) => row.username === 'other' && row.year_month === '2026-09'));
  assert.equal(state.writes.length, 1);
});

test('Repeated conflicts and storage failures do not report success', async () => {
  for (const options of [{ conflicts: 3 }, { writeError: true }, { invalidJson: true }, { missingNotice: true }, { tableExists: true }]) {
    const { state, save } = setup(options);
    const result = await save(request([{ username: 'alice', classKeys: [] }]));
    assert.equal(result.body.success, false);
    assert.equal(state.writes.length, 0);
  }
});

test('Invalid requests, unknown students and duplicate identities never write', async () => {
  for (const body of [
    { yearMonth: '2026-13', permissions: [{ username: 'alice', classKeys: [] }] },
    request([{ username: 'alice', classKeys: ['900-monwed'] }]),
    request([{ username: 'missing', classKeys: [] }]),
    request([{ username: 'alice', classKeys: [] }, { username: 'alice', classKeys: [] }]),
  ]) {
    const { state, save } = setup();
    assert.equal((await save(body)).body.success, false);
    assert.equal(state.writes.length, 0);
  }
});

function student(username = 'alice') {
  return { studentId: username === 'alice' ? 's1' : 's2', id: username, username,
    name: 'Original name', password: 'test-only-password', classKey: '800-monwed', classKeys: ['800-monwed'],
    monthKey: '2026-09', expiresAt: '', isActive: true,
    classKeysByMonth: { '2026-09': ['800-monwed'], '2026-10': ['800-tuthu'] }, classAccessRanges: {},
  };
}

test('Checkbox-only changes do not schedule account writes, deletion, general class changes or ranges', () => {
  const saved = [student(), student('bob')];
  const edited = plain(saved);
  edited[0].classKeysByMonth['2026-10'] = [];
  const plan = plain(buildStudentSavePlan(edited, saved, '2026-10'));
  assert.deepEqual(plan.accountItems, []);
  assert.deepEqual(plan.deletedUsernames, []);
  assert.deepEqual(plan.ranges, []);
  assert.deepEqual(plan.permissions, [{ username: 'alice', classKeys: [] }]);
  assert.deepEqual(edited[0].classKeys, saved[0].classKeys);
});

test('Other-month unsaved edits are not submitted; hidden unchanged students are not deleted', () => {
  const saved = [student(), student('bob')];
  const edited = plain(saved);
  edited[0].classKeysByMonth['2026-09'] = [];
  const plan = plain(buildStudentSavePlan(edited, saved, '2026-10'));
  assert.deepEqual(plan, { accountItems: [], deletedUsernames: [], permissions: [], ranges: [] });
});

test('Account add/delete/password/name/status editing remains separate from permissions', () => {
  const saved = [student(), student('bob')];
  const edited = [student()];
  edited[0].name = 'Edited'; edited[0].password = 'new-test-password'; edited[0].isActive = false;
  edited.push({ ...student('new'), studentId: 's3' });
  const plan = plain(buildStudentSavePlan(edited, saved, '2026-10'));
  assert.deepEqual(plan.deletedUsernames, ['bob']);
  assert.equal(plan.accountItems.length, 2);
  assert.equal(plan.accountItems[0].password, 'new-test-password');
  assert.equal(plan.accountItems[0].isActive, false);
  assert.equal('classKeysByMonth' in plan.accountItems[0], false);
  assert.deepEqual(plan.accountItems[0].classKeys, ['800-monwed']);
});

test('Explicit range edits are sent separately and only for the selected month', () => {
  const saved = [student()]; const edited = plain(saved);
  edited[0].classAccessRanges = { '2026-10': { '800-tuthu': { startCardId: 'oct-card', startOrder: 2 } },
    '2026-09': { '800-monwed': { startCardId: 'sep-card', startOrder: 3 } } };
  const plan = plain(buildStudentSavePlan(edited, saved, '2026-10'));
  assert.equal(plan.ranges.length, 1);
  assert.equal(plan.ranges[0].yearMonth, '2026-10');
  assert.deepEqual(plan.permissions, []);
  assert.deepEqual(plan.accountItems, []);
});

test('Account-details dispatch never touches monthly permissions and deletes only explicit names', async () => {
  const writes = [];
  const client = { from(table) {
    assert.equal(table, 'student_accounts');
    return {
      upsert: async (rows) => { writes.push({ action: 'upsert', rows: plain(rows) }); return { error: null }; },
      delete: () => ({ in: async (key, names) => { writes.push({ action: 'delete', key, names }); return { error: null }; } }),
    };
  } };
  const { saveStudentAccountDetails } = load('lib/save-student-account-details.ts', {
    'next/server': responseModule, './supabase-admin': { supabaseAdmin: client }, './operating-month': operating,
    './student-class-access-ranges': { upsertStudentClassAccessRanges: async () => { throw new Error('Unexpected range write'); } },
  });
  const result = await saveStudentAccountDetails({ items: [student()], deletedUsernames: ['bob'], ranges: [] });
  assert.equal(result.body.success, true);
  assert.equal('class_keys_by_month' in writes[0].rows[0], false);
  assert.deepEqual(writes[0].rows[0].class_keys, ['800-monwed']);
  assert.deepEqual(writes[1], { action: 'delete', key: 'username', names: ['bob'] });
});

function pageHarness(options = {}) {
  const hooks = [], requests = [];
  let cursor = 0, effects = [], tree;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useMemo: (fn) => fn(),
    useEffect(fn, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((dep, i) => dep !== previous[i])) effects.push(fn);
      hooks[index] = deps;
    },
  };
  const fetchMock = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, method: init.method ?? 'GET', body });
    if (init.method === 'POST') return { ok: !options.failPermissions || url !== '/api/save-student-month-permissions',
      json: async () => options.failPermissions && url === '/api/save-student-month-permissions'
        ? { success: false, message: 'mock failure' } : { success: true } };
    if (url === '/api/save-student-accounts') return { json: async () => options.failLoad
      ? { success: false } : { success: true, items: [student(), student('bob')] } };
    if (url.startsWith('/api/get-class-updates')) return { json: async () => ({ success: true, items: {} }) };
    throw new Error('Unexpected request');
  };
  const jsx = (type, props) => ({ type, props });
  const Page = load('app/admin/student-accounts/page.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '../AdminShell': { default: 'AdminShell' }, '../adminGuard': { getLoggedInAdmin: () => ({}) },
    '../../../lib/student-account-save-plan': { buildStudentSavePlan },
    '../../../lib/operating-month': operating,
  }, { fetch: fetchMock, window: { confirm: () => true } }).default;
  function render() { cursor = 0; tree = Page(); return tree; }
  async function settle() {
    for (let i = 0; i < 4; i++) {
      render(); const pending = effects; effects = []; pending.forEach((fn) => fn());
      await new Promise((resolve) => setImmediate(resolve));
    }
    return render();
  }
  function nodes() {
    const all = [];
    function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object' || !node.props) return;
      all.push(node); walk(node.props.children);
    }
    walk(tree); return all;
  }
  return { requests, render, settle, nodes,
    save: async () => { await nodes().find((n) => n.type === 'button' && n.props.children === '\uC800\uC7A5\uD558\uAE30').props.onClick(); render(); } };
}

test('Actual page checkbox save calls only the new API and acknowledges success without resending', async () => {
  const page = pageHarness(); await page.settle();
  const month = page.nodes().find((n) => n.type === 'select' && n.props.value === '2026-10');
  assert.ok(month);
  assert.ok(page.nodes().some((n) => n.type === 'option' && n.props.children === '2026\uB144 10\uC6D4'));
  const boxes = page.nodes().filter((n) => n.type === 'input' && n.props.type === 'checkbox');
  assert.equal(boxes.length, 8);
  boxes[0].props.onChange({ target: { checked: true } }); page.render();
  await page.save();
  const posts = page.requests.filter((r) => r.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/api/save-student-month-permissions');
  assert.equal(posts[0].body.yearMonth, '2026-10');
  assert.deepEqual(posts[0].body.permissions, [{ username: 'alice', classKeys: ['800-tuthu', '600-monwed'] }]);
  await page.save();
  assert.equal(page.requests.filter((r) => r.method === 'POST').length, 1);
});

test('Actual page mixed edits use separate calls; failed permissions remain pending for retry', async () => {
  const options = { failPermissions: true };
  const page = pageHarness(options); await page.settle();
  page.nodes().find((n) => n.type === 'input' && n.props.value === 'Original name').props.onChange({ target: { value: 'Edited name' } });
  page.render();
  page.nodes().find((n) => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  page.render(); await page.save();
  let posts = page.requests.filter((r) => r.method === 'POST');
  assert.deepEqual(posts.map((r) => r.url), ['/api/save-student-accounts', '/api/save-student-month-permissions']);
  assert.equal(posts[0].body.mode, 'account-details');
  assert.equal(posts[0].body.items.length, 1);
  assert.deepEqual(posts[0].body.deletedUsernames, []);
  assert.equal('classKeysByMonth' in posts[0].body.items[0], false);
  assert.ok(page.nodes().some((n) => typeof n.props.children === 'string' && n.props.children.includes('mock failure')));
  options.failPermissions = false; await page.save();
  posts = page.requests.filter((r) => r.method === 'POST');
  assert.equal(posts.length, 3);
  assert.equal(posts[2].url, '/api/save-student-month-permissions');
});

test('Actual page cannot save after list loading failed', async () => {
  const page = pageHarness({ failLoad: true }); await page.settle();
  const button = page.nodes().find((n) => n.type === 'button' && n.props.children === '\uC800\uC7A5\uD558\uAE30');
  assert.equal(button.props.disabled, true);
  await page.save();
  assert.equal(page.requests.filter((r) => r.method === 'POST').length, 0);
});
