import assert from 'node:assert/strict';
import test from 'node:test';
import { pageTitle, routeTitle, setTitleUnread, getTitleUnread, onTitleUnread, SITE_NAME } from './web-title.ts';

test('tab title names the section like Snapchat Web', () => {
  assert.equal(pageTitle('/chats'), 'Chat • SnapShot X');
  assert.equal(pageTitle('/chat/3f1c2b9a-1111-4222-8333-444455556666'), 'Chat • SnapShot X');
  assert.equal(pageTitle('/'), 'Camera • SnapShot X');
  assert.equal(pageTitle('/add/kevraz0r'), 'Vriend toevoegen • SnapShot X');
  assert.equal(pageTitle('/login'), 'Inloggen • SnapShot X');
  assert.equal(pageTitle('/help/'), 'Help en support • SnapShot X');
  assert.equal(routeTitle('/friends?x=1'), 'Vrienden');
  assert.equal(pageTitle('/iets-onbekends'), SITE_NAME);
  assert.equal(pageTitle(undefined), 'Camera • SnapShot X');
});

test('unread chats are counted in front, capped at 99+', () => {
  assert.equal(pageTitle('/chats', 2), '(2) Chat • SnapShot X');
  assert.equal(pageTitle('/map', 250), '(99+) Map • SnapShot X');
  assert.equal(pageTitle('/map', -3), 'Map • SnapShot X');
  assert.equal(pageTitle('/map', Number.NaN), 'Map • SnapShot X');
});

test('unread store notifies listeners only on change and can unsubscribe', () => {
  const seen = []; const off = onTitleUnread(n => seen.push(n));
  setTitleUnread(3); setTitleUnread(3); setTitleUnread(0); off(); setTitleUnread(5);
  assert.deepEqual(seen, [3, 0]); assert.equal(getTitleUnread(), 5); setTitleUnread(0);
});
