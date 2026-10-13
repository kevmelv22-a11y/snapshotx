import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../migrations/20261010110000_staff_console_quick_fixes.sql', import.meta.url), 'utf8');
const banGateSql = await readFile(new URL('../migrations/20261009103958_restore_staff_ban_gate.sql', import.meta.url), 'utf8');
const loginHistoryEdge = await readFile(new URL('../functions/record-login-history/index.ts', import.meta.url), 'utf8');
const activityTriggerSql = await readFile(new URL('../migrations/20261009212600_fix_activity_score_trigger.sql', import.meta.url), 'utf8');

test('message activity trigger reads sender_id from sx_messages', () => {
  const messageBranch = activityTriggerSql.match(/if tg_table_name = 'sx_messages' then([\s\S]*?)elsif tg_table_name = 'sx_stories' then/i)?.[1] || '';
  assert.match(messageBranch, /activity_user_id := new\.sender_id;/i);
  assert.doesNotMatch(messageBranch, /new\.owner_id/i);
});

test('staff RPC migration reloads the PostgREST schema cache after commit', () => {
  assert.match(sql, /notify\s+pgrst\s*,\s*'reload schema'\s*;/i);
});

for (const [name, signature] of [
  ['search users', 'public.sx_staff_search_users(text, uuid, integer)'],
  ['exact dashboard stats', 'public.sx_staff_stats()'],
  ['report context', 'public.sx_staff_report_context(uuid, text)'],
  ['staff roster', 'public.sx_staff_list_roles(uuid, integer)'],
]) {
  test(`${name} RPC is restricted to authenticated callers`, () => {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(sql, new RegExp(`revoke all on function ${escaped} from public, anon, authenticated;`, 'i'));
    assert.match(sql, new RegExp(`grant execute on function ${escaped} to authenticated;`, 'i'));
  });
}

test('all staff RPC implementations check authentication, active-ban status, and role', () => {
  for (const fn of ['sx_staff_search_users', 'sx_staff_stats', 'sx_staff_report_context', 'sx_staff_list_roles']) {
    const start = sql.indexOf(`function public.${fn}(`);
    assert.notEqual(start, -1, `${fn} is defined`);
    const bodyStart = sql.indexOf('as $$', start);
    const bodyEnd = sql.indexOf('$$;', bodyStart);
    const body = sql.slice(bodyStart, bodyEnd);
    assert.match(body, /auth\.uid\(\)/i, `${fn} checks the session`);
    assert.match(body, /sx_request_is_banned\(\)/i, `${fn} checks active bans`);
    assert.match(body, /has_staff_role/i, `${fn} checks staff role`);
  }
});

test('report content access is audited and never returns a storage path', () => {
  const start = sql.indexOf('function public.sx_staff_report_context(');
  const end = sql.indexOf('$$;', sql.indexOf('as $$', start));
  const body = sql.slice(start, end);
  assert.match(body, /sx_staff_report_context/i);
  assert.match(body, /insert into public\.audit_logs/i);
  assert.match(body, /'reason',\s*trim\(p_reason\)/i);
  assert.doesNotMatch(body, /media_path\s+text/i);
  assert.match(body, /m\.media_path is not null/i);
  assert.match(body, /m\.expires_at\s+is not null and m\.expires_at <= now\(\)/i);
});

test('existing privileged staff wrappers retain the active-ban gate', () => {
  for (const fn of ['sx_staff_list_chats', 'sx_staff_read_chat', 'sx_staff_delete_message', 'sx_staff_create_ban', 'sx_staff_revoke_ban']) {
    const start = banGateSql.indexOf(`create or replace function public.${fn}(`);
    assert.notEqual(start, -1, `${fn} repair is present`);
    const bodyStart = banGateSql.indexOf('as $$', start);
    const bodyEnd = banGateSql.indexOf('$$;', bodyStart);
    const body = banGateSql.slice(bodyStart, bodyEnd);
    assert.match(body, /sx_request_is_banned\(\)/i, `${fn} rejects banned staff`);
    assert.match(banGateSql.slice(start, bodyStart), /language plpgsql/i, `${fn} has an explicit SQL wrapper`);
  }
});

test('IP bans and login history use the same trusted proxy headers', () => {
  const start = sql.indexOf('create or replace function app_private.sx_request_is_banned');
  const end = sql.indexOf('$$;', sql.indexOf('as $$', start));
  const guard = sql.slice(start, end);
  assert.match(guard, /cf-connecting-ip/i);
  assert.match(guard, /x-real-ip/i);
  assert.doesNotMatch(guard, /x-forwarded-for/i);
  assert.match(loginHistoryEdge, /cf-connecting-ip/);
  assert.match(loginHistoryEdge, /x-real-ip/);
  assert.doesNotMatch(loginHistoryEdge, /x-forwarded-for/);
});
