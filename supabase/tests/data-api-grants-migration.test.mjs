import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../migrations/20261019120000_sx_data_api_grants_rls.sql', import.meta.url), 'utf8');
const code = sql.replace(/--.*$/gm, '');

test('marked as not applied and wrapped in one transaction', () => {
  assert.match(sql, /^-- =+\n-- NOT APPLIED\./);
  assert.match(code, /^\s*begin;/m);
  assert.match(code, /^\s*commit;/m);
  assert.match(code, /notify pgrst, 'reload schema';/);
});

test('the three live tables get authenticated grants (map, stories, friends)', () => {
  assert.match(code, /\['sx_locations',\s*'select, insert, update, delete'\]/);
  assert.match(code, /\['sx_stories',\s*'select, insert, update, delete'\]/);
  assert.match(code, /\['sx_friends',\s*'select'\]/);
  assert.match(code, /grant %s on public\.%I to authenticated/);
  assert.match(code, /grant select, insert, update, delete on public\.%I to service_role/);
});

test('anon never gets a table privilege; RLS is enabled for every listed table', () => {
  assert.doesNotMatch(code, /grant[^;]*\bto\s+anon\b/i);
  assert.doesNotMatch(code, /grant[^;]*,\s*anon\b/i);
  assert.match(code, /revoke all on public\.%I from anon/);
  assert.match(code, /alter table public\.%I enable row level security/);
});

test('idempotent: missing tables are skipped, existing policies are not duplicated', () => {
  assert.match(code, /to_regclass\('public\.' \|\| p_table\) is not null/);
  assert.match(code, /from pg_policies where schemaname = 'public' and tablename = p_table and policyname = p_policy/);
  assert.match(code, /drop policy if exists sx_locations_friends on public\.sx_locations/);
  assert.match(code, /drop policy if exists sx_active_ban_guard/);
  assert.doesNotMatch(code, /^\s*create policy /m, 'every policy goes through the existence check');
});

test('locations: friends only, fresh, sharing, ghost mode and audience respected', () => {
  const block = code.match(/cond := 'user_id <> [\s\S]*?create policy sx_locations_friends/)?.[0] || '';
  assert.match(block, /sharing = true/);
  assert.match(block, /updated_at > now\(\) - interval ''24 hours''/);
  assert.match(block, /app_private\.sx_is_friend\(user_id\)/);
  assert.match(block, /not ghost_forever and \(ghost_until is null or ghost_until <= now\(\)\)/);
  assert.match(block, /share_audience = ''all'' or \(share_audience = ''selected'' and app_private\.sx_location_allows\(user_id\)\)/);
  assert.match(code, /'sx_locations', 'sx_locations_self', \$p\$for all to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\) with check \(user_id = \(select auth\.uid\(\)\)\)/);
});

test('friends list and stories stay private', () => {
  assert.match(code, /'sx_friends', 'sx_friends_read', \$p\$for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\) and not app_private\.sx_blocked_with\(friend_id\)\)/);
  assert.match(code, /'sx_stories', 'sx_stories_read'[\s\S]*?not app_private\.sx_blocked_with\(owner_id\)[\s\S]*?app_private\.sx_is_friend\(owner_id\)/);
});

test('snap receipts stay server-side; helpers are SECURITY DEFINER with an empty search_path', () => {
  assert.match(code, /drop policy if exists sx_receipts_insert/);
  assert.match(code, /'sx_receipts', 'sx_receipts_insert'[\s\S]*?not m\.view_once/);
  assert.doesNotMatch(code, /\['sx_receipts',\s*'[^']*update/);
  for (const fn of ['sx_blocked_with', 'sx_is_friend', 'sx_location_allows', 'sx_is_member']) {
    assert.match(code, new RegExp(`function app_private\\.${fn}\\([^)]*\\)[^;]*?security definer set search_path = ''`, 's'));
    assert.match(code, new RegExp(`revoke all on function app_private\\.${fn}\\([^)]*\\) from public, anon;`));
  }
});

test('sx_ensure_profile: signed-in only, sanitised username, no anon execute', () => {
  assert.match(code, /create or replace function public\.sx_ensure_profile\(\)/);
  assert.match(code, /if v_uid is null then raise exception 'not_authenticated'/);
  assert.match(code, /v_base !~ '\^\[a-z0-9_\]\{3,24\}\$'/);
  assert.match(code, /on conflict \(id\) do nothing/);
  assert.match(code, /revoke all on function public\.sx_ensure_profile\(\) from public, anon;/);
  assert.match(code, /grant execute on function public\.sx_ensure_profile\(\) to authenticated;/);
});
