/**
 * Static posed avatar (roadmap step 8): poses / expressions from lib/avatar/poses, used for avatar stickers,
 * the profile pose picker in the avatarkast and story-ring portraits. Same layered art as WardrobeAvatar,
 * but the arm / head rotations are baked into SVG transforms (no animation), so it is cheap in lists.
 */
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ellipse, G, Path } from 'react-native-svg';
import type { Outfit } from '../../lib/avatar/outfit';
import { getPose, type AvatarSticker, type PoseId } from '../../lib/avatar/poses';
import { Avatar3DImage } from '../avatar3d/Avatar3D';
import { ArtImage, poseArtFor } from './ArtImage';
import { AvatarBust } from './AvatarBust';
import type { ArtKey } from '../../lib/avatar/avatarArt';
import type { Framing } from '../avatar3d/scene';
import { ArmParts, BodyParts, HairBehindParts, hasHairBehind, HeadParts, LayerSvg, lookFromOutfit, MIRROR, OverlayParts } from './AvatarArt';

/** Crops in avatar coordinates: full body, or upper body (stickers / portraits). Arms raised need headroom. */
const CROP_FULL = '-10 -40 220 420';
const CROP_UPPER = '8 -14 184 214';

/** 3D snapshot of the posed avatar (falls back to the 2D art below while loading / without WebGL). */
export const PosedAvatar = React.memo(function PosedAvatar(props: { outfit: Outfit; pose: PoseId; width: number; height: number; upper?: boolean; /** Custom crop in avatar coordinates. */ viewBox?: string }) {
  const { outfit, pose, width, height, upper = false, viewBox } = props;
  const framing: Framing = viewBox === BUST_VIEWBOX ? 'bust' : upper ? 'sticker' : 'full';
  // Default: pre-rendered art of the default character (personalisation not reflected); else 3D → 2D.
  if (framing === 'bust') return <View style={{ width, height }} pointerEvents="none" testID={`posed-avatar:${getPose(pose).id}`}><AvatarBust outfit={outfit} size={Math.min(width, height)}/></View>;
  const bust = null as ArtKey | null;
  const art = poseArtFor(outfit, pose);
  if (art) return <View style={{ width, height }} pointerEvents="none" testID={`posed-avatar:${getPose(pose).id}`}>
    {bust ? <ArtImage art={bust} width={width} height={height} fit="top" zoom={1.05} offsetY={0.02}/>
      : upper ? <ArtImage art={art} width={width} height={height} fit="top" zoom={pose === 'cheer' || pose === 'shrug' ? 1 : 1.25} offsetY={0.02}/>
      : <ArtImage art={art} width={width} height={height}/>}
  </View>;
  return <View style={{ width, height }} pointerEvents="none" testID={`posed-avatar:${getPose(pose).id}`}>
    <Avatar3DImage outfit={outfit} pose={pose} framing={framing} width={width} height={height} fallback={<PosedAvatar2D {...props}/>}/>
  </View>;
});

/** Classic layered 2D art (fallback). */
export const PosedAvatar2D = React.memo(function PosedAvatar2D({ outfit, pose, width, height, upper = false, viewBox }: { outfit: Outfit; pose: PoseId; width: number; height: number; upper?: boolean; viewBox?: string }) {
  const look = useMemo(() => lookFromOutfit(outfit), [outfit]);
  const p = getPose(pose);
  const head = `rotate(${p.head} 100 108)`;
  return <View style={{ width, height }} pointerEvents="none">
    <LayerSvg look={look} width={width} height={height} viewBox={viewBox ?? (upper ? CROP_UPPER : CROP_FULL)}>
      {ctx => <G>
        {hasHairBehind(look) && <G transform={head}><HairBehindParts ctx={ctx}/></G>}
        <BodyParts ctx={ctx}/>
        <G transform={head}><HeadParts ctx={ctx} expression={p.expression} gaze={p.gaze}/></G>
        <G transform={`rotate(${p.armL} 69.5 126)`}><ArmParts ctx={ctx} side="L" pose={p.handL}/></G>
        <G transform={`rotate(${p.armR} 130.5 126)`}><G transform={MIRROR}><ArmParts ctx={ctx} side="R" pose={p.handR === 'thumb' ? 'rest' : p.handR}/></G></G>
        {p.handR === 'thumb' && <Thumb skin={look.skin} angle={p.armR}/>}
        <OverlayParts ctx={ctx}/>
      </G>}
    </LayerSvg>
  </View>;
});

/** Avatar sticker: posed upper body with a Dutch caption badge. `size` is the square footprint. */
export const AvatarStickerArt = React.memo(function AvatarStickerArt({ outfit, sticker, size }: { outfit: Outfit; sticker: AvatarSticker; size: number }) {
  const fs = Math.max(10, size * 0.16);
  return <View style={{ width: size, height: size, alignItems: 'center' }} accessibilityLabel={`Avatarsticker ${sticker.caption}`} testID={`avatar-sticker:${sticker.id}`}>
    <View style={{ marginTop: sticker.captionTop ? size * 0.08 : 0 }}><PosedAvatar outfit={outfit} pose={sticker.pose} width={size} height={size * 0.92} upper viewBox={sticker.captionTop ? '18 20 164 214' : undefined}/></View>
    <View style={{ position: 'absolute', ...(sticker.captionTop ? { top: 0 } : { bottom: 0 }), backgroundColor: sticker.color, paddingHorizontal: fs * 0.6, paddingVertical: fs * 0.12, borderRadius: fs, borderWidth: Math.max(1.5, size * 0.02), borderColor: '#FFF', transform: [{ rotate: '-6deg' }] }}>
      <Text style={{ color: '#111', fontWeight: '900', fontSize: fs }}>{sticker.caption}</Text>
    </View>
  </View>;
});

/** Head-and-shoulders bust for big profile circles (bottom of the circle cuts through the chest). */
export const BUST_VIEWBOX = '28 4 144 180';

/** Thumbs-up drawn in screen space at the rotated right hand (rest hand centre 141.5,212.5; shoulder pivot 130.5,126). */
function Thumb({ skin, angle }: { skin: string; angle: number }) {
  const a = angle * Math.PI / 180, dx = 141.5 - 130.5, dy = 212.5 - 126;
  const x = 130.5 + dx * Math.cos(a) - dy * Math.sin(a), y = 126 + dx * Math.sin(a) + dy * Math.cos(a);
  return <G>
    <Ellipse cx={x} cy={y} rx="9" ry="8" fill={skin}/>
    <Path d={`M${x - 3} ${y - 5} L${x - 3} ${y - 22}`} stroke={skin} strokeWidth="7.5" strokeLinecap="round"/>
    <Path d={`M${x - 8} ${y + 1} Q${x} ${y + 3} ${x + 8} ${y + 1}M${x - 7} ${y - 3} Q${x} ${y - 1} ${x + 7} ${y - 3}`} stroke="#000" strokeOpacity={0.18} strokeWidth="1" fill="none"/>
  </G>;
}
