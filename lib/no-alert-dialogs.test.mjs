import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// Alert.alert is a no-op on react-native-web, and on Android a back/outside dismissal runs no button callback.
// User flows use components/ConfirmDialog (Modal with onRequestClose + onCancel) instead.
test('story delete + compose "Stuur naar" use the cross-platform ConfirmDialog, not Alert.alert', async () => {
  for (const f of ['../components/stories/StoryViewer.tsx', '../app/compose.tsx']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /Alert\.alert/, f);
    assert.match(src, /useConfirmDialog\(\)/, f);
    assert.match(src, /\{confirm\.dialog\}/, f);
  }
  const viewer = await readFile(new URL('../components/stories/StoryViewer.tsx', import.meta.url), 'utf8');
  assert.match(viewer, /\(\)=>hold\(false\)\)/, 'cancel resumes the paused story');
  const dlg = await readFile(new URL('../components/ConfirmDialog.tsx', import.meta.url), 'utf8');
  assert.match(dlg, /onCancel\?: \(\) => void/); assert.match(dlg, /onRequestClose=\{cancel\}/);
});
