import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../migrations/20261031193100_friend_qr_request.sql', import.meta.url), 'utf8');
const body = name => { const s = sql.indexOf(`function public.${name}(`); return sql.slice(s, sql.indexOf('$$;', s)); };

test('friend QR RPCs authenticate, reject banned callers and are not anon endpoints', () => {
  for (const [fn, sig] of [['sx_lookup_friend_code', 'text,uuid'], ['sx_request_friend', 'uuid']]) {
    assert.match(body(fn), /v_uid is null or app_private\.sx_request_is_banned\(\)/);
    assert.match(body(fn), /security definer set search_path = ''/);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(${sig}\\) from public, anon;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(${sig}\\) to authenticated;`));
  }
});

test('request: self/unknown/blocked rejected; reverse pending request is accepted mutually', () => {
  const b = body('sx_request_friend');
  assert.match(b, /p_user_id=v_uid then raise exception/);
  assert.match(b, /app_private\.sx_blocked_with\(p_user_id\) then raise exception/);
  assert.match(b, /sender_id=p_user_id and recipient_id=v_uid and status='pending' for update/);
  assert.match(b, /values \(v_uid,p_user_id\),\(p_user_id,v_uid\) on conflict do nothing/);
  assert.match(b, /pg_advisory_xact_lock/);
  assert.match(b, /insert into public\.sx_friend_requests\(sender_id,recipient_id,status\) values \(v_uid,p_user_id,'pending'\)/);
});

test('lookup hides blocked users and the migration never deletes data or touches RLS', () => {
  assert.match(body('sx_lookup_friend_code'), /app_private\.sx_blocked_with\(v_target\)\) then return/);
  assert.doesNotMatch(sql, /\bdelete\s+from\b|\bdrop\s+(table|policy)\b|disable row level security|truncate/i);
});
