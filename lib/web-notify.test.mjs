import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionOf, shouldWebNotify, webNotifyContent, webNotifyStatus } from './web-notify.ts';

const base = { browserOn: true, permission: 'granted', hidden: true, prefsAllow: true, muted: false, senderId: 'b', me: 'a', kind: 'text' };
test('shouldWebNotify needs opt-in, permission, hidden tab, prefs, not muted, not mine, not system', () => {
  assert.equal(shouldWebNotify(base), true);
  for (const [k, v] of [['browserOn', false], ['permission', 'default'], ['permission', 'denied'], ['hidden', false], ['prefsAllow', false], ['muted', true], ['senderId', 'a'], ['senderId', null], ['kind', 'system']])
    assert.equal(shouldWebNotify({ ...base, [k]: v }), false, `${k}=${v}`);
});

test('webNotifyContent never contains message text', () => {
  assert.deepEqual(webNotifyContent('Noor', 'text'), { title: 'Noor', body: 'stuurde je een chat' });
  assert.deepEqual(webNotifyContent('Noor', 'snap'), { title: 'Noor', body: 'stuurde je een snap' });
  assert.deepEqual(webNotifyContent('', 'voice'), { title: 'Een vriend', body: 'stuurde je een spraakbericht' });
  assert.deepEqual(webNotifyContent('Sam', 'photo', 'Weekend crew'), { title: 'Weekend crew', body: 'Sam stuurde een foto' });
});

test('status text + permissionOf', () => {
  assert.match(webNotifyStatus('denied', true), /Geblokkeerd/);
  assert.match(webNotifyStatus('granted', true), /^Aan/);
  assert.match(webNotifyStatus('unsupported', false), /ondersteunt geen/);
  assert.equal(permissionOf({ permission: 'granted' }), 'granted');
  assert.equal(permissionOf(undefined), 'unsupported');
  assert.equal(permissionOf({ permission: 'weird' }), 'unsupported');
});
