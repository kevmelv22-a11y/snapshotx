import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGISTER_GENDERS, GENDER_REQUIRED_ERROR, parseRegisterGender, registerMetadata } from './auth-form.ts';
test('Jongen / Meisje map to the avatar genders', () => {
  assert.deepEqual(REGISTER_GENDERS.map(g => [g.value, g.label]), [['male', 'Jongen'], ['female', 'Meisje']]);
  assert.match(GENDER_REQUIRED_ERROR, /jongen of een meisje/);
});
test('parseRegisterGender only accepts male/female', () => {
  assert.equal(parseRegisterGender('male'), 'male');
  assert.equal(parseRegisterGender('female'), 'female');
  for (const bad of [null, undefined, '', 'Jongen', 'x', 1]) assert.equal(parseRegisterGender(bad), null);
});
test('registerMetadata carries gender for saveCharacter / profiles.gender trigger', () => {
  const m = registerMetadata({ username: 'kevin.dev', birthdate: '2010-01-01', teen: true, phone: null }, 'female');
  assert.deepEqual(m, { username: 'kevin.dev', display_name: 'kevin.dev', birthdate: '2010-01-01', is_teen: true, gender: 'female' });
  assert.equal(registerMetadata({ username: 'a.b', birthdate: '1990-01-01', teen: false, phone: '+31612345678' }, 'male').phone, '+31612345678');
});
test('AuthScreen requires the choice before Account aanmaken and stores it', () => {
  const src = readFileSync(new URL('../components/auth/AuthScreen.tsx', import.meta.url), 'utf8');
  assert.match(src, /testID=\{`register-gender-\$\{g\.value\}`\}/);
  assert.match(src, /!!gender/);
  assert.match(src, /registerMetadata\(v, gender\)/);
  assert.match(src, /setGender\(gender\)/);
});
