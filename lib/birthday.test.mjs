import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_BIRTHDATE_CHANGES, birthdayBadge, birthdayCountdownLabel, daysUntilBirthday, formatBirthdateNl, isBirthdayToday, readBirthdayMeta, toInputValue, validateBirthdateChange, zodiacOf } from './birthday.ts';
import { HIDDEN_HEADER_TITLES } from './back-titles.ts';

const D = (iso) => new Date(`${iso}T00:00:00Z`);
const NOW = new Date('2026-10-31T12:00:00Z');

test('formatBirthdateNl / toInputValue', () => {
  assert.equal(formatBirthdateNl(D('2004-11-03')), '3 november 2004');
  assert.equal(toInputValue(D('2004-03-07')), '07-03-2004');
});

test('zodiacOf covers sign boundaries incl. Steenbok wrap', () => {
  assert.equal(zodiacOf(D('2000-01-19')).name, 'Steenbok');
  assert.equal(zodiacOf(D('2000-01-20')).name, 'Waterman');
  assert.equal(zodiacOf(D('2000-03-21')).name, 'Ram');
  assert.equal(zodiacOf(D('2000-07-23')).name, 'Leeuw');
  assert.equal(zodiacOf(D('2000-10-31')).name, 'Schorpioen');
  assert.equal(zodiacOf(D('2000-11-22')).name, 'Boogschutter');
  assert.equal(zodiacOf(D('2000-12-21')).name, 'Boogschutter');
  assert.equal(zodiacOf(D('2000-12-22')).name, 'Steenbok');
  assert.equal(zodiacOf(D('2000-12-31')).emoji, '♑');
});

test('daysUntilBirthday: today, upcoming, passed this year, 29 Feb', () => {
  assert.equal(daysUntilBirthday(D('2004-10-31'), NOW), 0);
  assert.ok(isBirthdayToday(D('2004-10-31'), NOW));
  assert.equal(daysUntilBirthday(D('2004-11-14'), NOW), 14);
  assert.equal(daysUntilBirthday(D('2004-10-30'), NOW), 364);
  assert.equal(daysUntilBirthday(D('2008-02-29'), new Date('2027-02-27T10:00:00Z')), 1); // 28 Feb in 2027
  assert.equal(daysUntilBirthday(D('2008-02-29'), new Date('2028-02-28T10:00:00Z')), 1); // 29 Feb in leap 2028
});

test('birthdayCountdownLabel in Dutch', () => {
  assert.equal(birthdayCountdownLabel(D('2004-11-14'), NOW), 'Nog 14 dagen tot je 22e verjaardag');
  assert.equal(birthdayCountdownLabel(D('2004-11-01'), NOW), 'Morgen word je 22 🎉');
  assert.equal(birthdayCountdownLabel(D('2004-10-31'), NOW), 'Gefeliciteerd! Je bent vandaag 22 geworden 🎂');
});

test('birthdayBadge only on the day with Verjaardagsfeest on', () => {
  assert.equal(birthdayBadge(D('2004-10-31'), true, NOW), '🎂');
  assert.equal(birthdayBadge(D('2004-10-31'), false, NOW), '');
  assert.equal(birthdayBadge(D('2004-11-01'), true, NOW), '');
  assert.equal(birthdayBadge(null, true, NOW), '');
});

test('readBirthdayMeta tolerates missing/odd metadata', () => {
  assert.deepEqual(readBirthdayMeta(undefined, NOW), { birth: null, party: true, changesLeft: MAX_BIRTHDATE_CHANGES, teen: false });
  const r = readBirthdayMeta({ birthdate: '2011-05-01', birthday_party: false, birthdate_changes: 1 }, NOW);
  assert.equal(r.party, false); assert.equal(r.changesLeft, 1); assert.equal(r.teen, true);
  assert.equal(readBirthdayMeta({ birthdate: 'nonsense', is_teen: true, birthdate_changes: 'x' }, NOW).teen, true);
  assert.equal(readBirthdayMeta({ birthdate_changes: 9 }, NOW).changesLeft, 0);
});

test('validateBirthdateChange: limits, min age, teen cannot become adult', () => {
  const adult = readBirthdayMeta({ birthdate: '2000-01-01' }, NOW), teen = readBirthdayMeta({ birthdate: '2011-01-01' }, NOW);
  const ok = validateBirthdateChange('02-01-2000', adult, 0, NOW);
  assert.deepEqual(ok, { ok: true, patch: { birthdate: '2000-01-02', is_teen: false, birthdate_changes: 1 } });
  assert.match(validateBirthdateChange('01-01-2000', adult, 0, NOW).error, /al je geboortedatum/);
  assert.match(validateBirthdateChange('31-02-2000', adult, 0, NOW).error, /DD-MM-JJJJ/);
  assert.match(validateBirthdateChange('01-01-2020', adult, 0, NOW).error, /minimaal 13/);
  assert.match(validateBirthdateChange('01-01-1990', teen, 0, NOW).error, /niet ouder dan 17/);
  assert.equal(validateBirthdateChange('01-06-2011', teen, 1, NOW).ok, true);
  const used = readBirthdayMeta({ birthdate: '2000-01-01', birthdate_changes: 2 }, NOW);
  assert.match(validateBirthdateChange('02-01-2000', used, 2, NOW).error, /maximale aantal/);
  const adultToTeen = validateBirthdateChange('2012-01-01', adult, 1, NOW);
  assert.ok(adultToTeen.ok && adultToTeen.patch.is_teen === true && adultToTeen.patch.birthdate_changes === 2);
});

test('Verjaardag screen is wired into Instellingen, root stack and demo', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const settings = read('../app/settings.tsx'), root = read('../app/_layout.tsx'), demo = read('./demo-client.ts'), screen = read('../app/birthday.tsx');
  assert.match(settings, /row\('Verjaardag',[^)]*\(\)=>router\.push\('\/birthday'\)/);
  assert.match(settings, /'Verjaardag':'mijn account[^']*geboortedatum/);
  assert.match(root, /name="birthday" options=\{\{headerShown:false,title:T\.birthday\}\}/);
  assert.equal(HIDDEN_HEADER_TITLES.birthday, 'Verjaardag');
  assert.match(demo, /birthdate: '\d{4}-\d{2}-\d{2}'/);
  assert.ok(screen.includes('validateBirthdateChange') && screen.includes('birthday_party') && screen.includes('SUPPORT_MAILTO'));
});

test('own profile shows 🎂 next to the name on your birthday', () => {
  const profile = readFileSync(new URL('../app/(tabs)/profile.tsx', import.meta.url), 'utf8');
  assert.ok(profile.includes('birthdayBadge(bd.birth,bd.party)') && profile.includes('Jarig vandaag'));
});

test('birthday follows the local calendar day (00:30 Amsterdam = 23:30 UTC the day before)', () => {
  const late = new Date(2026, 9, 31, 0, 30); // local 31 Oct 00:30
  assert.equal(daysUntilBirthday(D('2004-10-31'), late), 0);
  assert.equal(daysUntilBirthday(D('2004-11-14'), late), 14);
});
