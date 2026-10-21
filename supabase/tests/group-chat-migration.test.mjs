import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../migrations/20261021150000_group_chat_management.sql', import.meta.url), 'utf8');
const body = (name) => { const start = sql.indexOf(`function public.${name}(`); assert.ok(start > 0, name); const b = sql.indexOf('as $$', start); return sql.slice(b, sql.indexOf('end $$;', b)); };
const RPCS = { sx_rename_group: 'uuid, text', sx_add_group_members: 'uuid, uuid[]', sx_remove_group_member: 'uuid, uuid', sx_leave_group: 'uuid' };

test('group RPCs are security definer with a fixed search_path, not public endpoints', () => {
  for (const [name, args] of Object.entries(RPCS)) {
    assert.match(sql, new RegExp(`function public\\.${name}\\([^)]*\\)[^$]*security definer set search_path = ''`, 'i'), name);
    assert.ok(sql.includes(`revoke all on function public.${name}(${args}) from public, anon;`), `${name} revoke`);
    assert.ok(sql.includes(`grant execute on function public.${name}(${args}) to authenticated;`), `${name} grant`);
    assert.match(body(name), /app_private\.sx_lock_group\(p_thread_id\)/, `${name} checks auth + membership`);
  }
  assert.match(sql, /sx_lock_group[\s\S]*?if uid is null then raise exception 'Sign in required'/);
  assert.match(sql, /for update;/, 'thread row locked against concurrent adds');
  for (const helper of ['sx_display_name(uuid)', 'sx_lock_group(uuid)', 'sx_group_line(uuid, text)'])
    assert.ok(sql.includes(`revoke all on function app_private.${helper} from public, anon, authenticated;`), helper);
});

test('rules: friends only, max 20, creator-only removal, leave hands over / cleans up', () => {
  const add = body('sx_add_group_members');
  assert.match(add, /v_count \+ cardinality\(v_new\) > 20 then raise exception 'Group is full \(max 20\)'/);
  assert.match(add, /public\.sx_friends f where f\.user_id = uid and f\.friend_id = target/);
  assert.match(add, /public\.sx_blocks b/);
  assert.match(body('sx_remove_group_member'), /t\.created_by is distinct from uid then raise exception 'Only the group creator/);
  assert.match(body('sx_remove_group_member'), /p_user_id = uid then raise exception/);
  const leave = body('sx_leave_group');
  assert.match(leave, /delete from public\.sx_members where thread_id = p_thread_id and user_id = uid/);
  assert.match(leave, /update public\.sx_threads set created_by = v_next/);
  assert.match(leave, /delete from public\.sx_threads where id = p_thread_id/);
  assert.ok(leave.indexOf('heeft de groep verlaten') < leave.indexOf('delete from public.sx_members'), 'line written while still a member');
  assert.match(body('sx_rename_group'), /raise exception 'Invalid group name'/);
});

test('system lines match lib/group-chat.ts texts', () => {
  for (const t of ["' heeft de groep hernoemd naar '", "' toegevoegd'", "' uit de groep verwijderd'", "' heeft de groep verlaten'", "' en '"]) assert.ok(sql.includes(t), t);
  assert.match(sql, /'system', left\(p_text, 200\)/);
});

test('is_group flag keeps shrunk groups from being reused as 1-on-1', () => {
  assert.match(sql, /add column if not exists is_group boolean not null default false/);
  assert.match(body('sx_open_thread'), /t\.title is null and not t\.is_group/);
  assert.match(body('sx_open_thread'), /cardinality\(peers\)>1 or group_title is not null/);
});
