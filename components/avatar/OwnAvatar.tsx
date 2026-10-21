/**
 * The signed-in user's own avatar: the saved Avatar-kast outfit when there is one,
 * otherwise the start look of the chosen character set. Always the Avatar-kast art (AvatarBust / OutfitArt).
 */
import React from 'react';
import { View } from 'react-native';
import { useStartOutfit } from '../../hooks/useWardrobeSync';
import type { AvatarAppearance } from '../../lib/avatar';
import type { Outfit } from '../../lib/avatar/outfit';
import { AvatarBust } from './AvatarBust';
import { OutfitArt } from './OutfitArt';

/** Round bust portrait of a wardrobe outfit: head+shoulders crop of the same art the doll shows (AvatarBust). */
export const WardrobePortrait = React.memo(function WardrobePortrait({ outfit, size, selected = false, label = 'Mijn avatar' }: { outfit: Outfit; size: number; selected?: boolean; label?: string }) {
  const ring = Math.max(2, Math.round(size * 0.045));
  return <AvatarBust outfit={outfit} size={size} ring={ring} ringColor={selected ? '#FFE436' : '#E6A2EE'} label={label}/>;
});

type OwnProps = { userId: string | null | undefined; size: number; appearance?: AvatarAppearance; selected?: boolean; /** Replaces the classic MapAvatar fallback. */ fallback?: React.ReactNode };

/** Round own avatar (profile, map buttons, headers). */
export function OwnAvatar({ userId, size, appearance, selected, fallback }: OwnProps) {
  const outfit = useStartOutfit(userId);
  // No saved outfit yet = the default character (pre-rendered bust art), never the old classic avatar.
  void appearance; void fallback;
  return <WardrobePortrait outfit={outfit} size={size} selected={selected}/>;
}

/**
 * Full figure in a view that really occupies width × height (list cards, native map markers): the same
 * ChatGPT-style art as the Avatar-kast (OutfitArt: worn-band composite / worn art / look art), never the old doll.
 */
export function SizedFigure({ outfit, width }: { outfit: Outfit; width: number }) {
  const height = width * 119 / 82;
  return <View style={{ width, height, pointerEvents: 'none' }}><OutfitArt outfit={outfit} width={width} height={height}/></View>;
}

/** Full-body own avatar (map marker). Same footprint as MapExplorer (82 × 119 at size 82). */
export function OwnAvatarFigure({ userId, size = 82, appearance }: { userId: string | null | undefined; size?: number; appearance?: AvatarAppearance }) {
  const outfit = useStartOutfit(userId);
  void appearance;
  return <SizedFigure outfit={outfit} width={size}/>;
}
