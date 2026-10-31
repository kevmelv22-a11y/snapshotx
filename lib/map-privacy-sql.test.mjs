import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canFriendSee, enableGhost, privacyToRow, DEFAULT_PRIVACY } from './map-privacy.ts';

const rd = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const main = rd('../supabase/migrations/20261031150000_map_privacy_server.sql');
const dedupe = rd('../supabase/migrations/20261031150100_map_privacy_helper_dedupe.sql');
const grants = rd('../supabase/migrations/20261019120000_sx_data_api_grants_rls.sql');
const norm = s => s.replace(/\s+/g, ' ').trim();
const policy = sql => norm(sql.match(/create policy sx_locations_friends on public\.sx_locations for select to authenticated using \(([\s\S]*?)\n\);/)[1]);

test('friends policy keeps the hardened live conditions and adds ghost + audience', () => {
  const p = policy(dedupe);
  for (const part of ['user_id <> (select auth.uid())', 'sharing = true', "updated_at > now() - interval '24 hours'", 'not ghost_forever',
    '(ghost_until is null or ghost_until <= now())', 'app_private.sx_is_friend(user_id)',
    "share_audience = 'all' or (share_audience = 'selected' and app_private.sx_location_allows(user_id))"])
    assert.ok(p.includes(part), part);
  assert.doesNotMatch(p, /public\.sx_friends/, 'block-aware helper, not the raw friends table');
});

test('dedupe migration matches the data-api migration helper and drops the duplicate', () => {
  assert.match(grants, /function app_private\.sx_location_allows\(p_owner uuid\)/);
  assert.match(dedupe, /drop function if exists app_private\.sx_location_allowed_for_me\(uuid\);/);
});

test('allow list: owner-only, friend check, no update, ban guard, re-runnable', () => {
  assert.match(main, /create table if not exists public\.sx_location_allowed/);
  assert.match(main, /check \(owner_id <> friend_id\)/);
  assert.match(main, /revoke all on public\.sx_location_allowed from public, anon, authenticated;/);
  assert.match(main, /grant select, delete on public\.sx_location_allowed to authenticated;/);
  assert.match(main, /grant insert \(owner_id, friend_id\) on public\.sx_location_allowed to authenticated;/);
  assert.match(main, /with check \(owner_id = \(select auth\.uid\(\)\) and app_private\.sx_is_friend\(friend_id\)\)/);
  assert.match(main, /sx_active_ban_guard on public\.sx_location_allowed as restrictive/);
  for (const m of main.matchAll(/create policy (\w+) on/g)) assert.match(main, new RegExp(`drop policy if exists ${m[1]} on`), m[1]);
});

test('columns, values and legacy-writer compatibility', () => {
  assert.match(main, /add column if not exists share_audience text not null default 'none'/);
  assert.match(main, /check \(share_audience in \('all', 'selected', 'none'\)\)/);
  assert.match(main, /update public\.sx_locations set share_audience = 'all' where sharing and share_audience = 'none';/);
  assert.match(main, /before insert or update on public\.sx_locations/);
  // The app always writes the values the check constraint allows.
  for (const audience of ['all', 'selected', 'none']) {
    const row = privacyToRow({ ...DEFAULT_PRIVACY, audience });
    assert.ok(['all', 'selected', 'none'].includes(row.share_audience));
    assert.equal(row.sharing, audience !== 'none');
  }
});

test('app-side mirror agrees with the server rule', () => {
  const now = Date.parse('2026-10-31T15:00:00Z');
  const all = { ...DEFAULT_PRIVACY, audience: 'all' };
  assert.equal(canFriendSee(all, 'x', now), true);
  assert.equal(canFriendSee(enableGhost(all, '3h', now), 'x', now), false);
  assert.equal(canFriendSee(enableGhost(all, '3h', now), 'x', now + 3 * 3600000 + 1), true);
  assert.equal(canFriendSee({ ...DEFAULT_PRIVACY, audience: 'selected', allowedIds: ['a'] }, 'b', now), false);
  assert.equal(canFriendSee({ ...DEFAULT_PRIVACY, audience: 'selected', allowedIds: ['a'] }, 'a', now), true);
});
