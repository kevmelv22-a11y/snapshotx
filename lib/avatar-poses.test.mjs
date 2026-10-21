import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { AVATAR_POSES, AVATAR_STICKERS, DEFAULT_POSE, POSES_BY_ID, chatPreviewText, chatStickerBody, editorToken, getPose, isPoseId, stickerFromChatBody, stickerFromEditorToken, storyRingColors, storyRingState } from './avatar/poses.ts';
import { WARDROBE_ITEMS } from './avatar/wardrobeItems.ts';

test('pose ids are unique, labels Dutch-ish and never mention Bitmoji', () => {
  assert.equal(new Set(AVATAR_POSES.map(p => p.id)).size, AVATAR_POSES.length);
  for (const p of AVATAR_POSES) { assert.ok(p.label.length > 0); assert.doesNotMatch(p.label, /bitmoji/i); }
  for (const id of ['wave', 'thumbs', 'laugh']) assert.ok(POSES_BY_ID.has(id), id);
});

test('getPose falls back to the default pose for unknown input', () => {
  assert.equal(getPose('wave').id, 'wave');
  assert.equal(getPose('dab').id, DEFAULT_POSE);
  assert.equal(getPose(undefined).id, DEFAULT_POSE);
  assert.equal(isPoseId('cheer'), true);
  assert.equal(isPoseId(42), false);
});

test('every sticker uses an existing pose; captions unique', () => {
  for (const s of AVATAR_STICKERS) assert.ok(POSES_BY_ID.has(s.pose), s.id);
  assert.equal(new Set(AVATAR_STICKERS.map(s => s.caption)).size, AVATAR_STICKERS.length);
});

test('editor token round-trips; emoji stays emoji', () => {
  for (const s of AVATAR_STICKERS) assert.equal(stickerFromEditorToken(editorToken(s.id))?.id, s.id);
  assert.equal(stickerFromEditorToken('😂'), null);
  assert.equal(stickerFromEditorToken('avatar:nope'), null);
  assert.equal(stickerFromEditorToken(null), null);
});

test('chat sticker body round-trips and rejects look-alikes', () => {
  for (const s of AVATAR_STICKERS) assert.equal(stickerFromChatBody(chatStickerBody(s.id))?.id, s.id);
  assert.equal(stickerFromChatBody('  [avatar-sticker:hoi]  ')?.id, 'hoi');
  assert.equal(stickerFromChatBody('hey [avatar-sticker:hoi]'), null);
  assert.equal(stickerFromChatBody('[avatar-sticker:unknown]'), null);
  assert.equal(stickerFromChatBody(null), null);
  assert.equal(chatPreviewText('[avatar-sticker:top]'), 'Avatarsticker: Top!');
  assert.equal(chatPreviewText('gewoon tekst'), 'gewoon tekst');
});

test('story ring state', () => {
  const now = 1000;
  const stories = [{ id: 'a', expiresAt: 2000 }, { id: 'b', expiresAt: 3000 }, { id: 'old', expiresAt: 500 }];
  assert.equal(storyRingState([], [], now), 'none');
  assert.equal(storyRingState([{ id: 'old', expiresAt: 500 }], [], now), 'none');
  assert.equal(storyRingState(stories, ['a'], now), 'unseen');
  assert.equal(storyRingState(stories, new Set(['a', 'b']), now), 'seen');
  assert.equal(storyRingColors('none'), null);
  assert.equal(storyRingColors('unseen')?.length, 2);
});

test('step 8 wardrobe additions: new items exist for the fictional brands', () => {
  for (const brand of ['Strideon', 'trivo', 'ROSSANO', 'klompz']) assert.ok(WARDROBE_ITEMS.filter(i => i.brand === brand).length >= 4, brand);
  assert.ok(WARDROBE_ITEMS.length >= 84);
});

test('migration pose list matches AVATAR_POSES', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261013180000_avatar_pose.sql', import.meta.url), 'utf8');
  const list = /pose in \(([^)]*)\)/.exec(sql)[1].split(',').map(x => x.trim().replace(/'/g, ''));
  assert.deepEqual(list, AVATAR_POSES.map(p => p.id));
});

test('Mode screen looks only reference existing items in the right category', async () => {
  const { TRY_LOOKS, MODE_HERO_ITEMS } = await import('./avatar/modeLooks.ts');
  const { ITEMS_BY_ID } = await import('./avatar/wardrobeItems.ts');
  assert.equal(TRY_LOOKS.length, 6);
  for (const look of [...TRY_LOOKS, { id: 'hero', items: MODE_HERO_ITEMS }])
    for (const [cat, id] of Object.entries(look.items)) assert.equal(ITEMS_BY_ID.get(id)?.category, cat, `${look.id}: ${id}`);
});
