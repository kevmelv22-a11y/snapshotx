/**
 * Static posed avatar (roadmap step 8): poses / expressions from lib/avatar/poses, used for avatar stickers,
 * the profile pose picker in the avatarkast and story-ring portraits. Always the ChatGPT-style art of the Kast.
 */
import React from 'react';
import { Text, View } from 'react-native';
import type { Outfit } from '../../lib/avatar/outfit';
import { getPose, type AvatarSticker, type PoseId, type StickerArtPose } from '../../lib/avatar/poses';
import { ArtImage, poseArtFor } from './ArtImage';
import { AvatarBust } from './AvatarBust';
import { OutfitArt } from './OutfitArt';
import type { ArtKey } from '../../lib/avatar/avatarArt';
import type { Framing } from '../avatar3d/scene';

/** Posed avatar in the Avatar-kast art: pose art of the default character, else the outfit's own art (no old doll / 3D). */
export const PosedAvatar = React.memo(function PosedAvatar(props: { outfit: Outfit; pose: PoseId | StickerArtPose; width: number; height: number; upper?: boolean; /** Custom crop in avatar coordinates. */ viewBox?: string }) {
  const { outfit, pose, width, height, upper = false, viewBox } = props;
  const framing: Framing = viewBox === BUST_VIEWBOX ? 'bust' : upper ? 'sticker' : 'full';
  if (framing === 'bust') return <View style={{ width, height }} pointerEvents="none" testID={`posed-avatar:${getPose(pose).id}`}><AvatarBust outfit={outfit} size={Math.min(width, height)}/></View>;
  const bust = null as ArtKey | null;
  const art = poseArtFor(outfit, pose);
  if (art) return <View style={{ width, height }} pointerEvents="none" testID={`posed-avatar:${getPose(pose).id}`}>
    {bust ? <ArtImage art={bust} width={width} height={height} fit="top" zoom={1.05} offsetY={0.02}/>
      : upper ? <ArtImage art={art} width={width} height={height} fit="top" zoom={WIDE_POSES.has(pose) ? 1 : 1.25} offsetY={0.02}/>
      : <ArtImage art={art} width={width} height={height}/>}
  </View>;
  // Personalised outfit (no pose art): the same Avatar-kast art (OutfitArt), standing; `upper` crops the top part.
  if (!upper) return <View style={{ width, height }} pointerEvents="none" testID={`posed-avatar:${getPose(pose).id}`}><OutfitArt outfit={outfit} width={width} height={height}/></View>;
  const figH = height * 1.75, figW = figH / ART_ASPECT;
  return <View style={{ width, height, overflow: 'hidden', alignItems: 'center' }} pointerEvents="none" testID={`posed-avatar:${getPose(pose).id}`}>
    <View style={{ width: figW, height: figH, marginTop: height * 0.02 }}><OutfitArt outfit={outfit} width={figW} height={figH}/></View>
  </View>;
});

/** Poses whose hands reach the sides or bottom of the image (raised arms, horns sign, crossed fingers, clapping, pointing): sticker framing without the 1.25 head zoom. */
const WIDE_POSES: ReadonlySet<string> = new Set(['cheer', 'shrug', 'rock', 'crossed', 'clap', 'point']);

/** Height / width of the full-figure art (Kast preview box: w × 1.77w). */
const ART_ASPECT = 1.77;

/** Avatar sticker: posed upper body with a Dutch caption badge. `size` is the square footprint. */
export const AvatarStickerArt = React.memo(function AvatarStickerArt({ outfit, sticker, size }: { outfit: Outfit; sticker: AvatarSticker; size: number }) {
  const fs = Math.max(10, size * 0.16);
  return <View style={{ width: size, height: size, alignItems: 'center' }} accessibilityLabel={`Avatarsticker ${sticker.caption}`} testID={`avatar-sticker:${sticker.id}`}>
    <View style={{ marginTop: sticker.captionTop ? size * 0.08 : 0 }}><PosedAvatar outfit={outfit} pose={sticker.art ?? sticker.pose} width={size} height={size * 0.92} upper viewBox={sticker.captionTop ? '18 20 164 214' : undefined}/></View>
    <View style={{ position: 'absolute', ...(sticker.captionTop ? { top: 0 } : { bottom: 0 }), backgroundColor: sticker.color, paddingHorizontal: fs * 0.6, paddingVertical: fs * 0.12, borderRadius: fs, borderWidth: Math.max(1.5, size * 0.02), borderColor: '#FFF', transform: [{ rotate: '-6deg' }] }}>
      <Text style={{ color: '#111', fontWeight: '900', fontSize: fs }}>{sticker.caption}</Text>
    </View>
  </View>;
});

/** Head-and-shoulders bust for big profile circles (bottom of the circle cuts through the chest). */
export const BUST_VIEWBOX = '28 4 144 180';
