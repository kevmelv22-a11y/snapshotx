import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordStrength, validatePasswordChange, reauthCredentials, passwordChangeError, MAX_PASSWORD_LENGTH } from './password-change.ts';

test('passwordStrength: short, trivial, and strong passwords', () => {
  assert.equal(passwordStrength('abc').score, 0);
  assert.equal(passwordStrength('abc').label, 'Te kort');
  assert.equal(passwordStrength('12345678').score, 1);
  assert.equal(passwordStrength('Wachtwoord').score, 1); // common, case-insensitive
  assert.equal(passwordStrength('aaaaaaaaaa').score, 1);
  assert.equal(passwordStrength('qwertyui').score, 1);
  assert.equal(passwordStrength('zonnebloem').score, 1);
  assert.equal(passwordStrength('zonnebloem7').score, 2);
  assert.equal(passwordStrength('Zonnebloem7').score, 3);
  assert.equal(passwordStrength('Zonnebloem7!Vlieg').score, 4);
  assert.equal(passwordStrength('zonnebloemveld').score, 2); // long but one kind
});

test('validatePasswordChange checks each field in order', () => {
  const ok = { current: 'Oud-wachtwoord1', next: 'Zonnebloem7!', repeat: 'Zonnebloem7!' };
  assert.deepEqual(validatePasswordChange(ok), { ok: true });
  assert.equal(validatePasswordChange({ ...ok, current: '' }).field, 'current');
  assert.equal(validatePasswordChange({ ...ok, next: 'kort', repeat: 'kort' }).field, 'next');
  assert.equal(validatePasswordChange({ ...ok, next: 'a1'.repeat(MAX_PASSWORD_LENGTH), repeat: 'a1'.repeat(MAX_PASSWORD_LENGTH) }).field, 'next');
  assert.equal(validatePasswordChange({ ...ok, next: ' Zonnebloem7', repeat: ' Zonnebloem7' }).field, 'next');
  const same = validatePasswordChange({ current: 'Zonnebloem7!', next: 'Zonnebloem7!', repeat: 'Zonnebloem7!' });
  assert.ok(!same.ok && same.error.includes('ander wachtwoord'));
  const weak = validatePasswordChange({ ...ok, next: '12345678', repeat: '12345678' });
  assert.ok(!weak.ok && weak.field === 'next' && weak.error.includes('te makkelijk'));
  const diff = validatePasswordChange({ ...ok, repeat: 'Zonnebloem8!' });
  assert.ok(!diff.ok && diff.field === 'repeat');
});

test('reauthCredentials prefers email, falls back to phone', () => {
  assert.deepEqual(reauthCredentials({ email: 'jij@example.com', phone: '31612345678' }, 'x'), { email: 'jij@example.com', password: 'x' });
  assert.deepEqual(reauthCredentials({ email: '', phone: '31612345678' }, 'x'), { phone: '+31612345678', password: 'x' });
  assert.deepEqual(reauthCredentials({ phone: '+31612345678' }, 'x'), { phone: '+31612345678', password: 'x' });
  assert.equal(reauthCredentials(null, 'x'), null);
  assert.equal(reauthCredentials({}, 'x'), null);
});

test('passwordChangeError maps Supabase Auth errors to Dutch', () => {
  assert.equal(passwordChangeError({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'reauth'), 'Je huidige wachtwoord klopt niet.');
  assert.match(passwordChangeError({ code: 'same_password' }, 'update'), /ander wachtwoord/);
  assert.match(passwordChangeError({ code: 'weak_password' }, 'update'), /te zwak/);
  assert.match(passwordChangeError({ message: 'Email rate limit exceeded' }, 'update'), /Te veel pogingen/);
  assert.match(passwordChangeError(new Error('Failed to fetch'), 'reauth'), /Geen verbinding/);
  assert.match(passwordChangeError(null, 'update'), /kon niet worden gewijzigd/);
});

test('Instellingen links to the Wachtwoord screen and the root stack registers it', async () => {
  const { readFileSync } = await import('node:fs');
  const settings = readFileSync(new URL('../app/settings.tsx', import.meta.url), 'utf8');
  assert.match(settings, /row\('Wachtwoord',[^)]*\(\)=>router\.push\('\/change-password'\)/);
  const root = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(root, /name="change-password" options=\{\{headerShown:false,title:T\['change-password'\]\}\}/);
  const screen = readFileSync(new URL('../app/change-password.tsx', import.meta.url), 'utf8');
  assert.match(screen, /signInWithPassword\(creds/, 're-checks the current password first');
  assert.match(screen, /signOut\(\{scope:'others'\}\)/, 'logs out other devices, not this one');
});
