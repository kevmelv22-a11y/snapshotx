import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as S from './shared-stories.ts';
import { sendSummary, splitTargets, STORY_TARGET } from './send-to.ts';

test('titles, targets, labels', () => {
  assert.equal(S.cleanSharedTitle('  Weekend   Texel '), 'Weekend Texel');
  assert.equal(S.cleanSharedTitle('   '), null);
  assert.equal(S.cleanSharedTitle('x'.repeat(41)), null);
  assert.equal(S.suggestTitle(['Aria', 'Eva', 'Cleo']), 'Aria, Eva & ik');
  assert.equal(S.suggestTitle([]), 'Ons verhaal');
  assert.equal(S.sharedIdOf(S.sharedTarget('g1')), 'g1');
  assert.equal(S.sharedIdOf('abc'), null);
  assert.equal(S.membersLabel(1), '1 lid'); assert.equal(S.membersLabel(4), '4 leden');
  assert.match(S.sharedErrorText('Only friends can be added'), /eigen vrienden/);
  assert.match(S.sharedErrorText('Shared story is full (max 30)'), /30/);
});

test('feed split + bubbles: unseen first, empty groups last', () => {
  const rows = [
    { id: 's1', owner_id: 'a', created_at: '2026-11-20T08:00:00Z', shared_story_id: null },
    { id: 's2', owner_id: 'b', created_at: '2026-11-20T09:00:00Z', shared_story_id: 'g1' },
    { id: 's3', owner_id: 'c', created_at: '2026-11-20T10:00:00Z', shared_story_id: 'g2' },
  ];
  const { personal, shared } = S.splitStoryFeed(rows);
  assert.deepEqual(personal.map(r => r.id), ['s1']);
  assert.deepEqual([...shared.keys()], ['g1', 'g2']);
  const groups = [{ id: 'g0', title: 'Leeg', created_by: 'a', created_at: '' }, { id: 'g1', title: 'Weekend', created_by: 'a', created_at: '' }, { id: 'g2', title: 'Klas', created_by: 'a', created_at: '' }];
  const members = [{ shared_story_id: 'g1', user_id: 'a' }, { shared_story_id: 'g1', user_id: 'b' }];
  const b = S.sharedBubbles(groups, members, rows, new Set(['s3']));
  assert.deepEqual(b.map(x => [x.id, x.ring]), [['g1', 'unseen'], ['g2', 'seen'], ['g0', 'none']]);
  assert.equal(b[0].members, 2); assert.equal(b[0].count, 1);
  assert.deepEqual(S.addableFriends([{ id: 'a' }, { id: 'z' }], ['a']).map(f => f.id), ['z']);
});

test('Verzenden naar: shared targets split out and named', () => {
  const sel = [STORY_TARGET, S.sharedTarget('g1'), 'f1'];
  assert.deepEqual(splitTargets(sel), { story: true, friendIds: ['f1'], sharedIds: ['g1'] });
  assert.equal(sendSummary(sel, [{ id: 'f1', display_name: 'Aria' }, { id: S.sharedTarget('g1'), display_name: 'Weekend' }]), 'Mijn verhaal, Weekend, Aria');
});

test('migration: members-only reads, friends-only adds, private + soft-delete on leave', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261120060000_shared_stories.sql', import.meta.url), 'utf8');
  assert.match(sql, /shared_story_id is null and \(visibility = 'everyone' or exists/);
  assert.match(sql, /shared_story_id is not null and app_private\.sx_is_shared_member\(shared_story_id\)/);
  assert.match(sql, /check \(shared_story_id is null or visibility = 'friends'\)/);
  assert.match(sql, /public\.sx_friends f where f\.user_id = uid and f\.friend_id = target/);
  assert.match(sql, /> 30 then raise exception/);
  assert.match(sql, /revoke all on public\.sx_shared_stories, public\.sx_shared_story_members from anon, authenticated;/);
  for (const fn of ['sx_create_shared_story(text, uuid[])', 'sx_add_shared_story_members(uuid, uuid[])', 'sx_leave_shared_story(uuid)']) {
    assert.ok(sql.includes(`revoke all on function public.${fn} from public, anon;`), fn);
    assert.ok(sql.includes(`grant execute on function public.${fn} to authenticated;`), fn);
  }
  assert.ok(sql.includes('revoke all on function app_private.sx_shared_story_add(uuid, uuid[]) from public, anon, authenticated;'));
  assert.match(sql, /update public\.sx_stories set removed_at = now\(\)/);
  assert.match(sql, /on delete set null/);
  assert.match(sql, /created_by uuid references auth\.users\(id\) on delete set null/);
  // storage media follows the same members-only rule
  assert.match(sql, /create policy sx_media_read on storage\.objects[\s\S]*s\.shared_story_id is not null and app_private\.sx_is_shared_member\(s\.shared_story_id\)/);
});

test('viewer group + personal filter', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const rows = [
    { id: 'a', owner_id: 'x', created_at: '2026-11-20T10:00:00Z', expires_at: '2026-11-21T10:00:00Z', shared_story_id: 'g1' },
    { id: 'b', owner_id: 'y', created_at: '2026-11-20T09:00:00Z', expires_at: '2026-11-21T09:00:00Z', shared_story_id: 'g1' },
    { id: 'c', owner_id: 'y', created_at: '2026-11-20T09:00:00Z', expires_at: '2026-11-20T11:00:00Z', shared_story_id: 'g1' },
    { id: 'd', owner_id: 'y', created_at: '2026-11-20T09:00:00Z', expires_at: '2026-11-21T09:00:00Z', shared_story_id: null },
  ];
  const g = S.sharedViewerGroup(rows, 'g1', new Set(['b']), now);
  assert.equal(g.ownerId, 'shared:g1'); assert.deepEqual(g.stories.map(s => s.id), ['b', 'a']); assert.equal(g.allSeen, false);
  assert.equal(S.sharedViewerGroup(rows, 'g9', new Set(), now), null);
  assert.deepEqual(S.personalOnly(rows).map(r => r.id), ['d']);
});
