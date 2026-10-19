/**
 * Avatar for someone whose Avatar-kast outfit we don't have: their demo portrait (friendArt) when there is
 * one, else the default character in the same ChatGPT-style art as the Avatar-kast (AvatarBust / OutfitArt).
 * The old procedural Snapshot X doll is gone; `appearance` (classic editor indices) is no longer drawn.
 */
import React from 'react';
import { View } from 'react-native';
import type { AvatarAppearance } from '../lib/avatar';
import { DEFAULT_OUTFIT } from '../lib/avatar/outfit';
import { friendArtFor } from '../lib/avatar/friendArt';
import { FriendArtCircle } from './avatar/ArtImage';
import { AvatarBust } from './avatar/AvatarBust';
import { OutfitArt } from './avatar/OutfitArt';

type Props = { id: string; size?: number; selected?: boolean; appearance?: AvatarAppearance };

/** Round portrait (lists, map dock, banners). */
export function MapAvatar({ id, size = 54, selected = false }: Props) {
  if (friendArtFor(id)) return <FriendArtCircle id={id} size={size} selected={selected}/>;
  return <AvatarBust outfit={DEFAULT_OUTFIT} size={size} ring={Math.max(2, Math.round(size * 0.045))} ringColor={selected ? '#FFE436' : '#E6A2EE'} label="Avatar"/>;
}

/** Full-body figure (map marker), footprint size × size·119/82. */
export function MapExplorer({ id, size = 82 }: { id: string; own?: boolean; appearance?: AvatarAppearance; size?: number }) {
  const height = size * 119 / 82;
  if (friendArtFor(id)) return <View style={{ width: size, height, alignItems: 'center', justifyContent: 'flex-end' }}><FriendArtCircle id={id} size={size * 0.8}/></View>;
  return <View style={{ width: size, height, pointerEvents: 'none' }}><OutfitArt outfit={DEFAULT_OUTFIT} width={size} height={height}/></View>;
}
