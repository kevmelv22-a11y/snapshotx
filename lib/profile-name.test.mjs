import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { PROFILE_NAME_COLUMNS, profileName, profileNames } from './profile-name.ts';

test('display name first, else @username, never an id or empty', () => {
  assert.equal(profileName({ display_name: 'Noor', username: 'noor' }), 'Noor');
  assert.equal(profileName({ display_name: '  ', username: 'KevRaz0r' }), '@kevraz0r');
  assert.equal(profileName({ display_name: null, username: '@kev.savage' }), '@kev.savage');
  assert.equal(profileName({ display_name: null, username: null }), 'Snapshot X-gebruiker');
  assert.equal(profileName(null, 'Vriend'), 'Vriend');
  assert.equal(profileName({ username: 'bad name with spaces' }), 'Snapshot X-gebruiker');
  assert.deepEqual(profileNames([{ id: 'a', display_name: '', username: 'lisa' }, { id: 'b', display_name: 'Sam', username: 'sam' }]), { a: '@lisa', b: 'Sam' });
  assert.deepEqual(profileNames(null), {});
});

test('screens that list other people fetch the username too (no display_name-only profile lookups left)', () => {
  assert.equal(PROFILE_NAME_COLUMNS, 'id,display_name,username');
  for (const f of ['app/(tabs)/stories.tsx', 'app/stories/[owner].tsx', 'app/uitgelicht.tsx', 'app/(tabs)/profile.tsx', 'app/friend/[id].tsx', 'components/chat/ForwardSheet.tsx', 'lib/chat-list.ts', 'app/compose.tsx', 'app/(tabs)/chats.tsx', 'app/story/[id].tsx', 'components/chat/GroupInfoSheet.tsx', 'app/chat/[id].tsx']) {
    const src = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from\('profiles'\)\.select\('id,display_name'\)/, f);
    assert.match(src, /PROFILE_NAME_COLUMNS/, f);
  }
});

test('open chat: members, "Gezien door" and my own system lines (screenshot, wallpaper, retention, unsend) use display name or @username', () => {
  const src = fs.readFileSync(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from\('profiles'\)\.select\('id,display_name'\)/);
  assert.doesNotMatch(src, /user_metadata\?\.display_name\|\|'(Iemand|Je vriend|Jij)'/);
  assert.match(src, /screenshotText\(myName,false,screenshotSubject\(/);
  assert.match(src, /retentionChangeText\(myName,mode\)/);
  assert.match(src, /wallpaperChangeText\(myName,/);
  assert.equal(profileName({ display_name: '', username: 'kevraz0r' }, 'Iemand'), '@kevraz0r');
});
