import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spotlightBody, parseSpotlight, startFirst, SPOT_LABEL } from './spotlight-share.ts';
import { chatPreviewText } from './avatar/poses.ts';
import { quoteOf } from './chat-replies.ts';
import { canEdit } from './chat-edits.ts';

const ID = '0b000000-0000-4000-8000-000000000011', OW = '0a000000-0000-4000-8000-000000000001';
test('spotlight share body: validated uuids, clipped caption/name, round-trip', () => {
  const b = spotlightBody({ id: ID, owner_id: OW, caption: '  Zon,\n zee en zand ☀️ ' }, 'Aria de Vries');
  assert.deepEqual(parseSpotlight(b), { id: ID, owner: OW, name: 'Aria de Vries', caption: 'Zon, zee en zand ☀️' });
  assert.equal(spotlightBody({ id: 'x', owner_id: OW }), null);
  assert.equal(parseSpotlight('[spot]{"id":"x","o":"y"}'), null);
  assert.equal(parseSpotlight('[spot]{'), null);
  assert.equal([...parseSpotlight(spotlightBody({ id: ID, owner_id: OW, caption: 'a'.repeat(200) })).caption].length, 80);
});
test('shared card opens Uitgelicht with that snap first; gone snap is reported', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(startFirst(items, 'c'), { items: [{ id: 'c' }, { id: 'a' }, { id: 'b' }], found: true });
  assert.deepEqual(startFirst(items, 'zz'), { items, found: false });
  assert.deepEqual(startFirst(items, undefined), { items, found: true });
});
test('previews, quotes and edit rules treat a shared Spotlight as a card', () => {
  const b = spotlightBody({ id: ID, owner_id: OW, caption: 'Strand' }, 'Aria');
  assert.equal(chatPreviewText(b), `${SPOT_LABEL.preview}: Strand`);
  assert.equal(quoteOf({ kind: 'text', body: b }).excerpt, SPOT_LABEL.preview);
  const now = Date.now();
  assert.equal(canEdit({ id: '1', kind: 'text', body: b, sender_id: 'me', created_at: new Date(now).toISOString() }, 'me', now), false);
  assert.equal(canEdit({ id: '2', kind: 'text', body: 'hoi', sender_id: 'me', created_at: new Date(now).toISOString() }, 'me', now), true);
});
test('Spotlight Delen opens the Stuur naar… sheet with Delen buiten de app; chat renders the card', async () => {
  const sp = await readFile(new URL('../components/spotlight/SpotlightScreen.tsx', import.meta.url), 'utf8');
  assert.match(sp, /onShare=\{async i=>\{if\(!me\)return shareOutside\(i\);setSharing\(i\);return false\}\}/);
  assert.match(sp, /<ForwardSheet me=\{me\}[^>]*extra=\{\{label:SPOT_LABEL\.outside/);
  const fw = await readFile(new URL('../components/chat/ForwardSheet.tsx', import.meta.url), 'utf8');
  assert.match(fw, /if\(onSendTo\)await onSendTo\(/);
  const chat = await readFile(new URL('../app/chat/[id].tsx', import.meta.url), 'utf8');
  assert.match(chat, /<SpotlightBubble spot=\{spot\}/);
  const u = await readFile(new URL('../app/uitgelicht.tsx', import.meta.url), 'utf8');
  assert.match(u, /startId=/);
});
