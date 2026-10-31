import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261101000000_revoke_anon_sx_is_plus.sql', import.meta.url), 'utf8');
test('sx_is_plus: no longer executable signed out, still for signed-in users', () => {
  assert.match(sql, /revoke execute on function public\.sx_is_plus\(uuid\) from public;/);
  assert.match(sql, /revoke execute on function public\.sx_is_plus\(uuid\) from anon;/);
  assert.match(sql, /grant execute on function public\.sx_is_plus\(uuid\) to authenticated, service_role;/);
  assert.doesNotMatch(sql, /\b(drop|delete|truncate|alter table)\b/i);
});
