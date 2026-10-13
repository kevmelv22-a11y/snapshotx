/**
 * 3D avatar React components.
 *  - Avatar3DImage: cached PNG snapshot of the avatar (cheap in lists: stickers, chat, map pins, grid cards, portraits).
 *  - useAvatarRig: outfit → rig (modules + colours).
 * Both fall back to `fallback` (the classic 2D art) while loading or when 3D is unavailable.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import type { Outfit } from '../../lib/avatar/outfit';
import { ITEMS_BY_ID } from '../../lib/avatar/wardrobeItems';
import { rigFromOutfit, type AvatarRig3D, type Pose3DId } from '../../lib/avatar3d/rig';
import type { Framing } from './scene';
import { cachedSnapshot, renderSnapshot, supports3D } from './snapshot';

export function useAvatarRig(outfit: Outfit): AvatarRig3D {
  return useMemo(() => rigFromOutfit(outfit, id => ITEMS_BY_ID.get(id)), [outfit]);
}

let support: boolean | null = null;
export function avatar3DSupported(): boolean { return support ?? (support = supports3D()); }

type ImgProps = { outfit: Outfit; pose?: Pose3DId; framing: Framing; width: number; height: number; fallback?: React.ReactNode; style?: StyleProp<ImageStyle>; testID?: string };

export const Avatar3DImage = React.memo(function Avatar3DImage({ outfit, pose = 'stand', framing, width, height, fallback, style, testID }: ImgProps) {
  const rig = useAvatarRig(outfit);
  const size = useMemo(() => [Math.round(width), Math.round(height)] as [number, number], [width, height]);
  const [uri, setUri] = useState<string | null>(() => avatar3DSupported() ? cachedSnapshot(rig, pose, framing, size) : null);
  useEffect(() => {
    if (!avatar3DSupported()) return;
    let live = true;
    const hit = cachedSnapshot(rig, pose, framing, size);
    if (hit) { setUri(hit); return; }
    renderSnapshot(rig, pose, framing, size).then(u => { if (live) setUri(u); }).catch(() => { if (live) setUri(null); });
    return () => { live = false; };
  }, [rig, pose, framing, size]);
  if (!uri) return <View style={{ width, height }} testID={testID ? `${testID}:loading` : undefined}>{fallback}</View>;
  return <Image source={{ uri }} style={[{ width, height }, style]} testID={testID} accessibilityIgnoresInvertColors/>;
});
