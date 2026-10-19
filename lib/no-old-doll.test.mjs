// Guard: user-facing avatar screens draw the Avatar-kast art (OutfitArt / AvatarBust), never the old
// procedural doll (AvatarArt FigureArt/HeadPreviewArt/LayerSvg, PosedAvatar2D, 3D renders, classic MapAvatar SVG).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const OLD = /\b(FigureArt|HeadPreviewArt|LayerSvg|PosedAvatar2D|WardrobePortrait2D|Avatar3DImage|Avatar3DView|lookFromOutfit)\b/;
const FILES = [
  'app/avatar-editor.tsx', 'app/avatar/kast.tsx', 'app/(tabs)/profile.tsx',
  'components/avatar/OwnAvatar.tsx', 'components/avatar/FriendAvatar.tsx', 'components/avatar/PosedAvatar.tsx',
  'components/avatar/ModeScreen.tsx', 'components/avatar/PosePicker.tsx', 'components/MapAvatar.tsx',
];

test('avatar screens do not use the old doll renderers', () => {
  for (const f of FILES) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, OLD, `${f} still references an old doll renderer`);
  }
});

test('editor and shared figure render through OutfitArt', () => {
  for (const f of ['app/avatar-editor.tsx', 'components/avatar/OwnAvatar.tsx', 'components/avatar/ArtTile.tsx', 'components/MapAvatar.tsx']) {
    assert.match(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /OutfitArt/, f);
  }
});

test('editor offers no skin / hair colour / hairstyle options (the art cannot show them)', () => {
  const src = readFileSync(new URL('../app/avatar-editor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Huidskleur'|'Haarkleur|avatarOptions|mergeAppearance/);
  const kast = readFileSync(new URL('../app/avatar/kast.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(kast, />Kapsel<|>Haarkleur<|>Huidskleur</);
});
