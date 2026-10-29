import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkName, isNameAllowed, normalizeName } from './name-filter.ts';
import { validateRegister } from './auth-form.ts';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('normalizeName: lowercase, accents and l33t undone', () => {
  assert.equal(normalizeName('Kâñk3r'), 'kanker');
  assert.equal(normalizeName('$h1T'), 'shit');
});

test('blocks offensive words, also disguised', () => {
  for (const n of ['fuck', 'FuUuCk_you', 'f.u.c.k', 'xx_kanker_xx', 'k4nk3r', 'kankerlijer', 'tyfuslijer', 'kut', 'kut123', 'lul.de.behanger', 'dikke_lul', 'Bitch', 'b1tch', 'klootzak99', 'n1gg3r', 'Hitler', 'hoer', 'slet_', 'tering', 'teringlijer', 'rapist', 'mongool']) {
    const r = checkName(n, 'username');
    assert.equal(r.ok, false, n);
    assert.equal(r.reason, 'offensive', n);
  }
});

test('does not block innocent names that contain a bad word inside (Scunthorpe problem)', () => {
  for (const n of ['Scunthorpe', 'torpedo', 'hoera', 'pikachu', 'Dickens', 'cockpit', 'peacock', 'kutter', 'shitake', 'Kevin', 'kevin_v', 'Mohammed', 'Sexton', 'lulu', 'Pieter', 'Annemarie', 'Essex', 'skutsje', 'Mike Pikkemaat', 'Ajax fan', 'Isis', 'catering_jan', 'therapist', 'Mongolia']) {
    assert.equal(isNameAllowed(n), true, n);
  }
});

test('reserved: no impersonating Snapshot X / staff', () => {
  for (const n of ['snapshotx', 'SnapShot X', 'snapshot_x_official', 'Snapchat', 'admin', 'Support', 'snapx.staff', 'moderator', 'official', 'Team', 'h3lpdesk']) {
    const r = checkName(n, 'username');
    assert.equal(r.ok, false, n);
    assert.equal(r.reason, 'reserved', n);
    assert.match(r.error, /officieel Snapshot X-account/);
  }
  assert.ok(isNameAllowed('Teamleider Kees') && isNameAllowed('administratie_ruud') && isNameAllowed('Modderman'));
});

test('error text names the field', () => {
  assert.match(checkName('kut', 'group').error, /^Deze groepsnaam/);
  assert.match(checkName('kut', 'display').error, /^Deze naam/);
  assert.match(checkName('kut', 'username').error, /^Deze gebruikersnaam/);
});

test('register rejects offensive / reserved usernames', () => {
  const base = { email: 'a@b.nl', password: '12345678', birthdate: '01-01-2000', phone: '' };
  const now = new Date('2026-10-29T00:00:00Z');
  assert.equal(validateRegister({ ...base, username: 'kevin_v' }, now).ok, true);
  const bad = validateRegister({ ...base, username: 'k4nker_boy' }, now);
  assert.equal(bad.ok, false); assert.match(bad.error, /grof of kwetsend/);
  const res = validateRegister({ ...base, username: 'snapshotx_support' }, now);
  assert.equal(res.ok, false); assert.match(res.error, /officieel/);
});

test('wired into settings name, new group and group rename', () => {
  assert.match(read('../app/settings.tsx'), /checkName\(next,'display'\)/);
  assert.match(read('../app/(tabs)/chats.tsx'), /checkName\(/);
  assert.match(read('../components/chat/GroupInfoSheet.tsx'), /checkName\(t,'group'\)/);
});
