import assert from 'node:assert/strict';
import test from 'node:test';
import * as N from './snap-nav.ts';
import * as S from './send-to.ts';

test('Snapchat tab order and swipe directions', () => {
  assert.deepEqual([...N.SNAP_TABS], ['map', 'chats', 'index', 'stories', 'videos']);
  assert.deepEqual(N.swipeTarget('index', 120, 5), { kind: 'tab', tab: 'chats' });
  assert.deepEqual(N.swipeTarget('index', -120, 5), { kind: 'tab', tab: 'stories' });
  assert.deepEqual(N.swipeTarget('chats', 120, 0), { kind: 'tab', tab: 'map' });
  assert.deepEqual(N.swipeTarget('stories', -120, 0), { kind: 'tab', tab: 'videos' });
  assert.equal(N.swipeTarget('map', 150, 0), null);
  assert.equal(N.swipeTarget('videos', -150, 0), null);
});
test('short or diagonal moves do nothing, flicks count', () => {
  assert.equal(N.swipeTarget('index', 50, 0), null);
  assert.deepEqual(N.swipeTarget('index', 50, 0, 1.2), { kind: 'tab', tab: 'chats' });
  assert.equal(N.swipeTarget('index', 100, 90), null);
  assert.equal(N.isHorizontalSwipe(30, 5), true);
  assert.equal(N.isHorizontalSwipe(30, 25), false);
});
test('swipe up on camera opens memories only when enabled', () => {
  assert.deepEqual(N.swipeTarget('index', 0, -160, 0, { up: true }), { kind: 'memories' });
  assert.equal(N.swipeTarget('index', 0, -160), null);
  assert.equal(N.swipeTarget('index', 0, 160, 0, { up: true }), null);
});
test('double tap window', () => {
  assert.equal(N.isDoubleTap(null, 1000), false);
  assert.equal(N.isDoubleTap(800, 1000), true);
  assert.equal(N.isDoubleTap(500, 1000), false);
});
test('send-to: filter, toggle, summary, split', () => {
  const f = [{ id: 'b', display_name: 'Milan' }, { id: 'a', display_name: 'Aria' }, { id: 'c', display_name: 'Jules' }, { id: 'd', display_name: 'Zoë' }];
  assert.deepEqual(S.filterFriends(f, '').map(x => x.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(S.filterFriends(f, 'mi').map(x => x.id), ['b']);
  assert.deepEqual(S.toggleTarget(['a'], 'a'), []);
  assert.deepEqual(S.toggleTarget(['a'], 'b'), ['a', 'b']);
  assert.equal(S.sendSummary([S.STORY_TARGET, 'a'], f), 'Mijn verhaal, Aria');
  assert.equal(S.sendSummary(['a', 'b', 'c', 'd', S.STORY_TARGET], f), 'Aria, Milan, Jules +2');
  assert.equal(S.sendSummary([], f), '');
  assert.deepEqual(S.splitTargets([S.STORY_TARGET, 'a']), { story: true, friendIds: ['a'] });
});

import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('tab bar follows Snapchat order and swipes are wired on the pager tabs', () => {
  const layout = read('app/(tabs)/_layout.tsx');
  const order = [...layout.matchAll(/\['(\w+)','[\w-]+',TAB_LABEL\.\w+\]/g)].map(m => m[1]);
  assert.deepEqual(order, ['map', 'chats', 'index', 'stories', 'videos']);
  assert.match(layout, /name="friends" options=\{\{href:null\}\}/);
  for (const [f, tab] of [['app/(tabs)/index.tsx', 'index'], ['app/(tabs)/chats.tsx', 'chats'], ['app/(tabs)/stories.tsx', 'stories'], ['app/(tabs)/videos.tsx', 'videos']]) {
    assert.match(read(f), new RegExp(`useTabSwipe\\('${tab}'`), f);
  }
});
test('camera: memories + lenses beside the shutter, double tap flips', () => {
  const cam = read('app/(tabs)/index.tsx');
  for (const id of ['camera-memories', 'camera-shutter', 'camera-lenses', 'camera-preview', 'camera-add-friend']) assert.match(cam, new RegExp(`testID="${id}"`), id);
  assert.match(cam, /isDoubleTap\(lastTap\.current,now\)/);
});
test('send-to sheet posts story and snaps in one send; spotlight plays only the visible video', () => {
  const compose = read('app/compose.tsx');
  assert.match(compose, /splitTargets\(selected\)/);
  assert.match(compose, /testID="send-my-story"/);
  assert.match(read('components/spotlight/SpotlightScreen.tsx'), /media_type==='video'&&!active/);
  assert.match(read('app/stories/[owner].tsx'), /from\('sx_story_reactions'\)\.upsert\(\{story_id:s\.id,user_id:me,emoji\},\{onConflict:'story_id,user_id'\}\)/);
});
