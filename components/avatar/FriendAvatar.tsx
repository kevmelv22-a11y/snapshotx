/**
 * A friend's avatar: their saved Avatar-kast outfit when we have it (hooks/useFriendOutfits), a neutral
 * placeholder while that is still being looked up ('pending': persisted cache hydrating / first fetch), and
 * otherwise the default character in the same art (MapAvatar / MapExplorer) or the screen's own fallback.
 * The placeholder is what keeps the default art from flashing before the outfit arrives after an app start.
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import type { Gender, Outfit } from '../../lib/avatar/outfit';
import { MapAvatar, MapExplorer } from '../MapAvatar';
import { SizedFigure, WardrobePortrait } from './OwnAvatar';
import { FriendArtCircle } from './ArtImage';
import { friendArtFor } from '../../lib/avatar/friendArt';

type OutfitProp = Outfit | 'pending' | null | undefined;
type Props = { id: string; outfit: OutfitProp; size: number; selected?: boolean; name?: string; /** Character set for the default art when there is no outfit. */ gender?: Gender; /** Replaces the classic MapAvatar fallback. */ fallback?: React.ReactNode };

/** Short, stable signature of an outfit (testID only: lets tests see WHICH outfit is on screen). */
function signature(outfit: Outfit): string {
  const json = JSON.stringify(outfit);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h * 33) ^ json.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function useTestId(id: string, outfit: OutfitProp): string {
  return useMemo(() => `friend-avatar:${id.toLowerCase()}:${outfit === 'pending' ? 'placeholder' : outfit ? `outfit:${signature(outfit)}` : 'classic'}`, [id, outfit]);
}

/** Round portrait (lists, map dock, banners). */
export function FriendAvatar({ id, outfit, size, selected, name, gender, fallback }: Props) {
  const testID = useTestId(id, outfit);
  let content: React.ReactNode;
  if (outfit && outfit !== 'pending') {
    content = <WardrobePortrait outfit={outfit} size={size} selected={selected} label={name ? `Avatar van ${name}` : 'Avatar van vriend'}/>;
  } else if (friendArtFor(id)) {
    content = <FriendArtCircle id={id} size={size} selected={selected}/>;
  } else if (outfit === 'pending') {
    content = <View accessibilityLabel={name ? `Avatar van ${name} wordt geladen` : 'Avatar wordt geladen'} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2C2536', borderWidth: Math.max(2, Math.round(size / 20)), borderColor: selected ? '#FFE436' : '#4A4058' }}/>;
  } else if (outfit) {
    content = <WardrobePortrait outfit={outfit} size={size} selected={selected} label={name ? `Avatar van ${name}` : 'Avatar van vriend'}/>;
  } else {
    content = fallback ?? <MapAvatar id={id} size={size} selected={selected} gender={gender}/>;
  }
  return <View testID={testID} style={{ width: size, height: size }}>{content}</View>;
}

/** Full-body figure (map marker). Same footprint as MapExplorer: size × size·119/82. */
export function FriendAvatarFigure({ id, outfit, size = 82 }: { id: string; outfit: OutfitProp; size?: number }) {
  const testID = useTestId(id, outfit);
  const height = size * 119 / 82;
  if (friendArtFor(id)) return <View testID={testID} style={{ width: size, height, alignItems: 'center', justifyContent: 'flex-end' }}><FriendArtCircle id={id} size={size * 0.8}/></View>;
  if (outfit === 'pending') {
    // Neutral silhouette-sized pill: keeps the marker's footprint/anchor stable until the outfit is known.
    return <View testID={testID} accessibilityLabel="Avatar wordt geladen" style={{ width: size, height, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, backgroundColor: '#2C2536', borderWidth: 2, borderColor: '#4A4058', marginBottom: 2 }}/>
      <View style={{ width: size * 0.56, height: height * 0.5, borderTopLeftRadius: size * 0.28, borderTopRightRadius: size * 0.28, borderRadius: 10, backgroundColor: '#2C2536', borderWidth: 2, borderColor: '#4A4058' }}/>
    </View>;
  }
  if (outfit) return <View testID={testID}><SizedFigure outfit={outfit} width={size}/></View>;
  return <View testID={testID} style={{ width: size, height }}><MapExplorer id={id} size={size}/></View>;
}
