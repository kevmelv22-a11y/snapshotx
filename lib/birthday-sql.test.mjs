import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_BIRTHDATE_CHANGES, birthdateSaveError } from './birthday.ts';
import { MIN_AGE, TEEN_MAX_AGE } from './auth-form.ts';

const sql = readFileSync(new URL('../supabase/migrations/20261031120000_birthday_rules_server.sql', import.meta.url), 'utf8');
const constant = name => Number(sql.match(new RegExp(`${name} constant int := (\\d+);`))?.[1]);

test('server birthday guard uses the same limits as the app', () => {
  assert.equal(constant('min_age'), MIN_AGE);
  assert.equal(constant('teen_max_age'), TEEN_MAX_AGE);
  assert.equal(constant('max_changes'), MAX_BIRTHDATE_CHANGES);
});

test('server birthday guard only checks Auth API writes and keeps the counter server-side', () => {
  assert.match(sql, /if current_user <> 'supabase_auth_admin' then return new; end if;/);
  assert.match(sql, /before insert or update of raw_user_meta_data on auth\.users/);
  assert.match(sql, /'birthdate_changes', used \+ 1/);
  assert.match(sql, /revoke all on function public\.sx_birthday_meta_guard\(\) from public, anon, authenticated;/);
});

test('birthdate save error: server rejection vs network problem', () => {
  assert.match(birthdateSaveError({ status: 500 }), /support/);
  assert.match(birthdateSaveError({ status: 422 }), /support/);
  assert.match(birthdateSaveError({}), /verbinding/);
  assert.match(birthdateSaveError({ status: 503 }), /verbinding/);
  assert.match(birthdateSaveError({ status: 429 }), /verbinding/);
  assert.match(birthdateSaveError(null), /verbinding/);
});
