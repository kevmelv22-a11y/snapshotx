/**
 * Pre-rendered avatar art images (default avatar art). NOTE: the images show the fixed default character
 * only — the user's hair / skin personalisation is not reflected (see lib/avatar/avatarArt.ts).
 */
import React from 'react';
import { Image, View } from 'react-native';
import { lookCardArt, nearestLookArt as near0, bustArtFor as bust0, lookArtFor as look0, poseArtFor as pose0, type ArtKey } from '../../lib/avatar/avatarArt';
import { MODE_HERO_ITEMS, TRY_LOOKS } from '../../lib/avatar/modeLooks';
import type { Outfit } from '../../lib/avatar/outfit';
import type { PoseId, StickerArtPose } from '../../lib/avatar/poses';
import { DEFAULT_FEMALE_OUTFIT, DEFAULT_OUTFIT } from '../../lib/avatar/outfit';
import { friendArtFor, type FriendArtKey } from '../../lib/avatar/friendArt';

// The default outfit (DEFAULT_OUTFIT) counts as the default character too, so new users get the art.
const DATA = { hero: MODE_HERO_ITEMS, looks: TRY_LOOKS, alt: [DEFAULT_OUTFIT], female: DEFAULT_FEMALE_OUTFIT };
export const lookArtFor = (o: Outfit) => look0(o, DATA);
export const poseArtFor = (o: Outfit, p: PoseId | 'think' | StickerArtPose) => pose0(o, p, DATA);
export const bustArtFor = (o: Outfit) => bust0(o, DATA);
export { lookCardArt };
import { ITEMS_BY_ID } from '../../lib/avatar/wardrobeItems';
/** Closest art image for any outfit (never the 3D/2D figure). */
export const nearestLookArt = (o: Outfit) => near0(o, DATA, id => ITEMS_BY_ID.get(id)?.colors[0] ?? null);

/* eslint-disable @typescript-eslint/no-require-imports */
export const ART: Record<ArtKey, { src: number; w: number; h: number }> = {
  'bust': { src: require('../../assets/avatar-art/bust.png'), w: 630, h: 711 },
  'look-black-bomber': { src: require('../../assets/avatar-art/look-black-bomber.png'), w: 250, h: 691 },
  'look-cream-hoodie': { src: require('../../assets/avatar-art/look-cream-hoodie.png'), w: 258, h: 688 },
  'look-default-hoodie': { src: require('../../assets/avatar-art/look-default-hoodie.png'), w: 257, h: 685 },
  'look-denim-jacket': { src: require('../../assets/avatar-art/look-denim-jacket.png'), w: 258, h: 688 },
  'look-green-jacket': { src: require('../../assets/avatar-art/look-green-jacket.png'), w: 247, h: 692 },
  'look-ripped-jeans': { src: require('../../assets/avatar-art/look-ripped-jeans.png'), w: 261, h: 692 },
  'look-tan-jacket': { src: require('../../assets/avatar-art/look-tan-jacket.png'), w: 247, h: 688 },
  'pose-cheer': { src: require('../../assets/avatar-art/pose-cheer.png'), w: 498, h: 685 },
  'pose-laugh': { src: require('../../assets/avatar-art/pose-laugh.png'), w: 269, h: 690 },
  'pose-peace': { src: require('../../assets/avatar-art/pose-peace.png'), w: 283, h: 692 },
  'pose-shrug': { src: require('../../assets/avatar-art/pose-shrug.png'), w: 432, h: 695 },
  'pose-surprised': { src: require('../../assets/avatar-art/pose-surprised.png'), w: 247, h: 695 },
  'pose-thinking': { src: require('../../assets/avatar-art/pose-thinking.png'), w: 259, h: 690 },
  'pose-thumbsup': { src: require('../../assets/avatar-art/pose-thumbsup.png'), w: 285, h: 696 },
  'pose-wave': { src: require('../../assets/avatar-art/pose-wave.png'), w: 324, h: 691 },
  'pose-heart': { src: require('../../assets/avatar-art/pose-heart.png'), w: 293, h: 692 },
  'pose-wink': { src: require('../../assets/avatar-art/pose-wink.png'), w: 244, h: 690 },
  // Female set (src/girl/*.jpg → rembg cut → pngquant; see src/girl/cut.py, deswoosh.py)
  'girl/bust': { src: require('../../assets/avatar-art/girl/bust.png'), w: 501, h: 692 },
  'girl/look-black-bomber': { src: require('../../assets/avatar-art/girl/look-black-bomber.png'), w: 253, h: 693 },
  'girl/look-cream-hoodie': { src: require('../../assets/avatar-art/girl/look-cream-hoodie.png'), w: 256, h: 694 },
  'girl/look-denim-jacket': { src: require('../../assets/avatar-art/girl/look-denim-jacket.png'), w: 258, h: 688 },
  'girl/look-green-jacket': { src: require('../../assets/avatar-art/girl/look-green-jacket.png'), w: 255, h: 694 },
  'girl/look-ripped-jeans': { src: require('../../assets/avatar-art/girl/look-ripped-jeans.png'), w: 262, h: 693 },
  'girl/look-tan-jacket': { src: require('../../assets/avatar-art/girl/look-tan-jacket.png'), w: 256, h: 692 },
  'girl/pose-cheer': { src: require('../../assets/avatar-art/girl/pose-cheer.png'), w: 385, h: 689 },
  'girl/pose-laugh': { src: require('../../assets/avatar-art/girl/pose-laugh.png'), w: 248, h: 695 },
  'girl/pose-peace': { src: require('../../assets/avatar-art/girl/pose-peace.png'), w: 284, h: 699 },
  'girl/pose-shrug': { src: require('../../assets/avatar-art/girl/pose-shrug.png'), w: 407, h: 695 },
  'girl/pose-surprised': { src: require('../../assets/avatar-art/girl/pose-surprised.png'), w: 247, h: 698 },
  'girl/pose-thinking': { src: require('../../assets/avatar-art/girl/pose-thinking.png'), w: 242, h: 693 },
  'girl/pose-thumbsup': { src: require('../../assets/avatar-art/girl/pose-thumbsup.png'), w: 274, h: 698 },
  'girl/pose-wave': { src: require('../../assets/avatar-art/girl/pose-wave.png'), w: 316, h: 696 },
  'girl/pose-heart': { src: require('../../assets/avatar-art/girl/pose-heart.png'), w: 276, h: 692 },
  'girl/pose-wink': { src: require('../../assets/avatar-art/girl/pose-wink.png'), w: 253, h: 696 },
};
export const FRIEND_ART: Record<FriendArtKey, number> = {
  'friend-blonde': require('../../assets/avatar-art/friend-blonde.png'), 'friend-brown': require('../../assets/avatar-art/friend-brown.png'),
  'friend-cap': require('../../assets/avatar-art/friend-cap.png'), 'friend-black': require('../../assets/avatar-art/friend-black.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Round demo-friend portrait (see lib/avatar/friendArt), or null when this user has none. */
export function FriendArtCircle({ id, size, selected = false }: { id: string; size: number; selected?: boolean }) {
  const key = friendArtFor(id);
  if (!key) return null;
  const ring = Math.max(2, Math.round(size * 0.04));
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: ring, borderColor: selected ? '#FFE436' : '#D9D9DE', backgroundColor: '#D9D9DE' }} testID={`friend-art:${key}`}>
    <Image source={FRIEND_ART[key]} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors/>
  </View>;
}

/**
 * Draws an art image inside width × height.
 *  - fit 'contain': whole figure, bottom-aligned (full body).
 *  - fit 'top': fills the width and crops from the top (upper body: stickers, profile bust, portraits);
 *    `zoom` > 1 scales up around the head, `offsetY` shifts (fraction of the box height).
 */
export function ArtImage({ art, width, height, fit = 'contain', zoom = 1, offsetY = 0, testID }: { art: ArtKey; width: number; height: number; fit?: 'contain' | 'top'; zoom?: number; offsetY?: number; testID?: string }) {
  const a = ART[art];
  let w: number, h: number, left: number, top: number;
  if (fit === 'contain') {
    const s = Math.min(width / a.w, height / a.h) * zoom; w = a.w * s; h = a.h * s; left = (width - w) / 2; top = height - h;
  } else {
    const s = (width / a.w) * zoom; w = a.w * s; h = a.h * s; left = (width - w) / 2; top = offsetY * height;
  }
  return <View style={{ width, height, overflow: 'hidden' }} pointerEvents="none" testID={testID}>
    <Image source={a.src} style={{ position: 'absolute', left, top, width: w, height: h }} resizeMode="stretch" accessibilityIgnoresInvertColors/>
  </View>;
}
