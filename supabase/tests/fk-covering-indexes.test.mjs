import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// 27 nov 2026: every Snapshot X foreign key the advisor reported as unindexed gets a covering index; index-only migration.
const HOT = ['sx_members (user_id)', 'sx_messages (sender_id)', 'sx_receipts (user_id)', 'sx_friends (friend_id)', 'sx_stories (owner_id)', 'sx_story_views (viewer_id)'];
test('fk covering index migration: idempotent, index-only, covers the hot paths, never touches pw_ tables', async () => {
  const sql = await readFile(new URL('../migrations/20261127190000_fk_covering_indexes.sql', import.meta.url), 'utf8');
  const stmts = sql.split('\n').filter(l => l.trim() && !l.startsWith('--'));
  assert.equal(stmts.length, 31);
  for (const s of stmts) assert.match(s, /^create index if not exists sx_[a-z_]+_idx on public\.sx_[a-z_]+ \([a-z_]+\);$/);
  for (const h of HOT) assert.ok(sql.includes(`public.${h}`), h);
  assert.doesNotMatch(stmts.join('\n'), /pw_|drop |policy|grant |revoke |alter table|insert |update |delete /i);
});
