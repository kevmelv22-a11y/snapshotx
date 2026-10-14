import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HIDDEN_HEADER_TITLES, TAB_BACK_TITLES, tabsBackTitle } from './back-titles.ts';

test('tabs back title follows the focused tab', () => {
  assert.equal(tabsBackTitle('profile'), 'Mijn profiel');
  assert.equal(tabsBackTitle('index'), 'Camera');
  assert.equal(tabsBackTitle('chats'), 'Chat');
  assert.equal(tabsBackTitle('friends'), 'Vrienden');
  assert.equal(tabsBackTitle('map'), 'Map');
  assert.equal(tabsBackTitle('videos'), 'Video’s');
  assert.equal(tabsBackTitle('stories'), 'Verhalen');
  assert.equal(tabsBackTitle(undefined), 'Camera', 'no tab state yet = initial index tab');
  assert.equal(tabsBackTitle('unknown'), 'Terug');
});

test('every tab screen file has a label and no label is a route name', () => {
  const layout = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const names = [
    ...[...layout.matchAll(/\['(\w+)','[\w-]+','[^']+'\]/g)].map((m) => m[1]),
    ...[...layout.matchAll(/name="([^"]+)"/g)].map((m) => m[1]),
  ];
  assert.ok(names.length >= 7, `found tabs: ${names}`);
  for (const n of names) assert.ok(TAB_BACK_TITLES[n], `tab ${n} has a back title`);
  for (const t of [...Object.values(TAB_BACK_TITLES), ...Object.values(HIDDEN_HEADER_TITLES)]) {
    assert.doesNotMatch(t, /[()\/\[\]]/, `${t} looks like a route name`);
  }
});

test('root layout gives every header-less root screen a title and wires the tabs title', () => {
  const root = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(root, /name="\(tabs\)" options=\{\(\{route\}\)=>/);
  assert.match(root, /tabsBackTitle\(getFocusedRouteNameFromRoute\(route\)\)/);
  for (const m of root.matchAll(/<Stack\.Screen name="([^"]+)" options=\{\{([^}]*)\}\}/g)) {
    if (/headerShown:false/.test(m[2])) assert.match(m[2], /title:/, `${m[1]} hides its header but needs a title for the next back button`);
  }
});
