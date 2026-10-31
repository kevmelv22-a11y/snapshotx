import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { friendlyError } from './db-errors.ts';

const rd = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ts = rd('./name-filter.ts');
const sql = rd('../supabase/migrations/20261031030000_server_name_filter.sql');

const tsList = name => {
  const m = ts.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(m, `list ${name} in name-filter.ts`);
  return [...m[1].replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
};
const sqlList = name => {
  const m = sql.match(new RegExp(`${name} text\\[\\] := array\\[([\\s\\S]*?)\\];`));
  assert.ok(m, `list ${name} in migration`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
};

test('server name filter uses exactly the same word lists as the app', () => {
  for (const [t, s] of [['BLOCK_ANYWHERE', 'block_anywhere'], ['BLOCK_WORD', 'block_word'], ['RESERVED_ANYWHERE', 'reserved_anywhere'], ['RESERVED_WORD', 'reserved_word']])
    assert.deepEqual(sqlList(s), tsList(t), `${t} vs ${s}`);
});

test('server name filter uses the same l33t table as the app', () => {
  const m = sql.match(/translate\(base, '([^']+)', '([^']+)'\)/);
  assert.ok(m);
  const map = Object.fromEntries([...m[1]].map((c, i) => [c, [...m[2]][i]]));
  const tsMap = Object.fromEntries([...ts.match(/const LEET[^{]*\{([^}]*)\}/)[1].matchAll(/'(.)': '(.)'/g)].map(x => [x[1], x[2]]));
  assert.deepEqual(map, tsMap);
});

test('server guard: signup never fails, updates raise name_not_allowed, no-JWT bypass', () => {
  assert.match(sql, /before insert or update of username, display_name on public\.profiles/);
  assert.match(sql, /before insert or update of title on public\.sx_threads/);
  assert.match(sql, /if auth\.uid\(\) is null then return new; end if;/);
  assert.match(sql, /new\.username := 'user_'/);
  assert.match(sql, /raise exception 'name_not_allowed:%'/);
});

test('name_not_allowed errors from the server become Dutch texts', () => {
  assert.equal(friendlyError({ code: '22023', message: 'name_not_allowed:offensive' }), 'Deze naam is niet toegestaan: er staat een grof of kwetsend woord in.');
  assert.equal(friendlyError({ code: '22023', message: 'name_not_allowed:reserved' }), 'Deze naam lijkt op een officieel Snapshot X-account. Kies een andere naam.');
});
