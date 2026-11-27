import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// Snapchat: a camera button next to "Antwoorden aan …" answers a story with a snap in the 1-on-1 chat.
test('story viewer offers a snap reply (not on your own snaps) that opens the camera bound to the 1-on-1 chat', async () => {
  const v = await readFile(new URL('../components/stories/StoryViewer.tsx', import.meta.url), 'utf8');
  assert.match(v, /testID="story-snap-reply"/);
  assert.match(v, /!!p\.onSnapReply&&story\.owner_id!==p\.meId/);
  assert.match(v, /if\(err\)\{setNotice\(err\);hold\(false\)\}/, 'an error resumes the story and is shown');
  const o = await readFile(new URL('../app/stories/[owner].tsx', import.meta.url), 'utf8');
  assert.match(o, /sx_open_thread',\{participants:\[s\.owner_id\]/);
  assert.match(o, /router\.push\(\{pathname:'\/\(tabs\)',params:\{threadId:String\(t\.data\)/);
  assert.match(o, /onSnapReply=\{onSnapReply\} focused=\{focused\}/);
  assert.match(v, /if\(p\.focused===false\)hold\(true\);else if\(p\.focused&&lastFocused===false\)hold\(false\)/, 'paused under the camera, resumed on return');
  const cam = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  assert.match(cam, /params:threadId\?\{threadId,chatTitle/, 'camera forwards the chat to compose');
});
