import test from 'node:test';
import assert from 'node:assert/strict';
import { DROP_TEXT, DROP_MAX_PHOTO_BYTES, dragHasFiles, dropConfirm, mediaKindOf, pickDroppedMedia } from './web-drop.ts';

test('mediaKindOf: mime first, extension fallback, svg refused', () => {
  assert.equal(mediaKindOf({ type: 'image/png' }), 'photo');
  assert.equal(mediaKindOf({ type: 'video/quicktime' }), 'video');
  assert.equal(mediaKindOf({ type: '', name: 'IMG_1.HEIC' }), 'photo');
  assert.equal(mediaKindOf({ type: '', name: 'clip.mov' }), 'video');
  assert.equal(mediaKindOf({ type: 'image/svg+xml', name: 'x.svg' }), null);
  assert.equal(mediaKindOf({ type: 'application/pdf', name: 'a.pdf' }), null);
});

test('pickDroppedMedia: picks the one media file, refuses many / wrong type / too big / empty', () => {
  assert.equal(pickDroppedMedia([]), null);
  assert.deepEqual(pickDroppedMedia([{ type: 'text/plain', size: 3 }, { type: 'image/jpeg', size: 10 }]), { ok: true, index: 1, kind: 'photo' });
  assert.deepEqual(pickDroppedMedia([{ type: 'application/pdf', size: 3 }]), { ok: false, error: DROP_TEXT.type });
  assert.deepEqual(pickDroppedMedia([{ type: 'image/jpeg', size: 1 }, { type: 'video/mp4', size: 1 }]), { ok: false, error: DROP_TEXT.many });
  assert.deepEqual(pickDroppedMedia([{ type: 'image/jpeg', size: DROP_MAX_PHOTO_BYTES + 1 }]), { ok: false, error: DROP_TEXT.photoBig });
  assert.deepEqual(pickDroppedMedia([{ type: 'video/mp4', size: 60 * 1024 * 1024 }]), { ok: false, error: DROP_TEXT.videoBig });
  assert.deepEqual(pickDroppedMedia([{ type: 'image/png', size: 0 }]), { ok: false, error: DROP_TEXT.empty });
});

test('dragHasFiles + dropConfirm', () => {
  assert.equal(dragHasFiles(['text/plain']), false);
  assert.equal(dragHasFiles(['Files', 'text/uri-list']), true);
  assert.equal(dragHasFiles(null), false);
  assert.equal(dropConfirm('photo', 'Noor').title, 'Foto versturen naar Noor?');
  assert.equal(dropConfirm('video', '').title, 'Video versturen naar dit gesprek?');
});
