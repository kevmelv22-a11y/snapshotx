import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIdentifier, normalizePhone, parseBirthdate, ageOn, validateRegister } from './auth-form.ts';
const NOW = new Date(Date.UTC(2026, 9, 27));
test('classifyIdentifier routes email, phone and username', () => {
  assert.deepEqual(classifyIdentifier(' Kevin@Example.com '), { kind: 'email', email: 'kevin@example.com' });
  assert.deepEqual(classifyIdentifier('06 1234 5678'), { kind: 'phone', phone: '+31612345678' });
  assert.deepEqual(classifyIdentifier('+31612345678'), { kind: 'phone', phone: '+31612345678' });
  assert.deepEqual(classifyIdentifier('@Kevin.dev'), { kind: 'username', username: 'kevin.dev' });
  assert.equal(classifyIdentifier(''), null);
  assert.equal(classifyIdentifier('a b'), null);
});
test('normalizePhone', () => { assert.equal(normalizePhone('0031612345678'), '+31612345678'); assert.equal(normalizePhone('12'), null); });
test('parseBirthdate accepts DD-MM-JJJJ and ISO, rejects impossible dates', () => {
  assert.equal(parseBirthdate('31-12-2000', NOW)?.toISOString().slice(0, 10), '2000-12-31');
  assert.equal(parseBirthdate('2000-12-31', NOW)?.toISOString().slice(0, 10), '2000-12-31');
  assert.equal(parseBirthdate('31-02-2000', NOW), null);
  assert.equal(parseBirthdate('01-01-2030', NOW), null);
});
test('ageOn counts birthdays exactly', () => {
  assert.equal(ageOn(new Date(Date.UTC(2013, 9, 27)), NOW), 13);
  assert.equal(ageOn(new Date(Date.UTC(2013, 9, 28)), NOW), 12);
});
test('validateRegister enforces minimum age 13 and flags teens', () => {
  const base = { username: 'kevin.dev', email: 'jij@example.com', password: '12345678', phone: '' };
  assert.equal(validateRegister({ ...base, birthdate: '28-10-2013' }, NOW).ok, false);
  const teen = validateRegister({ ...base, birthdate: '27-10-2010' }, NOW);
  assert.ok(teen.ok && teen.teen && teen.age === 16);
  const adult = validateRegister({ ...base, birthdate: '01-01-1990', phone: '+31612345678' }, NOW);
  assert.ok(adult.ok && !adult.teen && adult.phone === '+31612345678' && adult.birthdate === '1990-01-01');
  assert.equal(validateRegister({ ...base, password: 'short', birthdate: '01-01-1990' }, NOW).ok, false);
});
