import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../migrations/20261011170004_find_friends_privacy.sql', import.meta.url), 'utf8');

test('suggestions are based on mutual friends and respect discovery opt-out', () => {
  const start = sql.indexOf('function public.sx_suggest_friends(');
  const bodyStart = sql.indexOf('as $$', start);
  const bodyEnd = sql.indexOf('$$;', bodyStart);
  const body = sql.slice(bodyStart, bodyEnd);
  assert.match(sql, /add column if not exists find_me boolean not null default true/i);
  assert.match(body, /join public\.sx_friends f on f\.user_id = mf\.friend_id/i);
  assert.match(body, /coalesce\(pref\.find_me, true\)/i);
  assert.doesNotMatch(body, /activity_score/i);
});

test('suggestions exclude blocked users, friends, pending requests, and hidden profiles', () => {
  const start = sql.indexOf('function public.sx_suggest_friends(');
  const bodyStart = sql.indexOf('as $$', start);
  const bodyEnd = sql.indexOf('$$;', bodyStart);
  const body = sql.slice(bodyStart, bodyEnd);
  for (const relation of ['sx_blocks', 'sx_friend_requests', 'sx_hidden_suggestions']) {
    assert.match(body, new RegExp(`not exists \\(\\s*select 1 from public\\.${relation}`, 'i'));
  }
});

test('suggestion RPCs authenticate, cap results, and are not public endpoints', () => {
  assert.match(sql, /if v_uid is null then[\s\S]*?not_authenticated/i);
  assert.match(sql, /if v_limit < 1 or v_limit > 30/i);
  assert.match(sql, /revoke all on function public\.sx_suggest_friends\(integer\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sx_suggest_friends\(integer\) to authenticated/i);
  assert.match(sql, /revoke all on function public\.sx_hide_suggestion\(uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.sx_hide_suggestion\(uuid\) to authenticated/i);
});

test('hidden suggestion rows have RLS and owner-only access', () => {
  assert.match(sql, /alter table public\.sx_hidden_suggestions enable row level security/i);
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id/i);
});
