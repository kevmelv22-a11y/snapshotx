/**
 * The signed-in user's own avatar: the saved Avatar-kast outfit when there is one,
 * otherwise the classic Snapshot X avatar art (MapAvatar / MapExplorer) driven by the original editor.
 */
import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, RadialGradient, Stop } from 'react-native-svg';
import { useStartOutfit } from '../../hooks/useWardrobeSync';
import type { AvatarAppearance } from '../../lib/avatar';
import type { Outfit } from '../../lib/avatar/outfit';
import { Avatar3DImage } from '../avatar3d/Avatar3D';
import { ArtImage, lookArtFor } from './ArtImage';
import { AvatarBust } from './AvatarBust';
import { ArmParts, BodyParts, FigureArt, HairBehindParts, HeadParts, LookDefs, MIRROR, OverlayParts, lookFromOutfit } from './AvatarArt';

/** Full-figure crop used for map markers (fits the 82 × 119 MapExplorer footprint; leaves room for long hair). */
export const FIGURE_CROP: [number, number, number, number] = [30, 10, 140, 350];

// Bust crop in avatar coordinates (head centre ≈ 100,70; shoulders ≈ y 120).
const CX = 100, CY = 86, R = 68;

/** Round bust portrait of a wardrobe outfit: head+shoulders crop of the same art the doll shows (AvatarBust). */
export const WardrobePortrait = React.memo(function WardrobePortrait({ outfit, size, selected = false, label = 'Mijn avatar' }: { outfit: Outfit; size: number; selected?: boolean; label?: string }) {
  const ring = Math.max(2, Math.round(size * 0.045));
  return <AvatarBust outfit={outfit} size={size} ring={ring} ringColor={selected ? '#FFE436' : '#E6A2EE'} label={label}/>;
});

/** Classic 2D portrait (fallback). */
export const WardrobePortrait2D = React.memo(function WardrobePortrait2D({ outfit, size, selected = false, label = 'Mijn avatar' }: { outfit: Outfit; size: number; selected?: boolean; label?: string }) {
  const p = `op${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const look = lookFromOutfit(outfit);
  const ctx = { p, look };
  const ring = 3 * (2 * R) / size; // ≈3px ring at any size
  return <Svg width={size} height={size} viewBox={`${CX - R} ${CY - R} ${2 * R} ${2 * R}`} accessibilityLabel={label}>
    <LookDefs p={p} look={look}/>
    <Defs>
      <RadialGradient id={`${p}bg`} cx="0.4" cy="0.25" r="0.9"><Stop offset="0" stopColor="#9E85CA"/><Stop offset="1" stopColor="#3B2C6E"/></RadialGradient>
      <ClipPath id={`${p}clip`}><Circle cx={CX} cy={CY} r={R - ring / 2}/></ClipPath>
    </Defs>
    <Circle cx={CX} cy={CY} r={R - ring / 2} fill={`url(#${p}bg)`}/>
    <G clipPath={`url(#${p}clip)`}>
      <HairBehindParts ctx={ctx}/>
      <BodyParts ctx={ctx}/>
      <ArmParts ctx={ctx} side="L"/>
      <G transform={MIRROR}><ArmParts ctx={ctx} side="R"/></G>
      <HeadParts ctx={ctx} expression="smile"/>
      <OverlayParts ctx={ctx}/>
    </G>
    <Circle cx={CX} cy={CY} r={R - ring / 2} fill="none" stroke={selected ? '#FFE436' : '#E6A2EE'} strokeWidth={ring}/>
  </Svg>;
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
 * FigureArt in a view that really occupies width × height. FigureArt's Svg is absolutely positioned
 * (it's meant to be stacked on card backgrounds), so without this wrapper it has NO layout size, which
 * collapses list cards and gives 0×0 / clipped native map markers.
 */
export function SizedFigure({ outfit, width }: { outfit: Outfit; width: number }) {
  const height = width * 119 / 82;
  const art = lookArtFor(outfit);
  if (art) return <View style={{ width, height, pointerEvents: 'none' }}><ArtImage art={art} width={width} height={height}/></View>;
  return <View style={{ width, height, pointerEvents: 'none' }}>
    <Avatar3DImage outfit={outfit} framing="full" width={width} height={height} fallback={<FigureArt outfit={outfit} width={width} height={height} crop={FIGURE_CROP}/>}/>
  </View>;
}

/** Full-body own avatar (map marker). Same footprint as MapExplorer (82 × 119 at size 82). */
export function OwnAvatarFigure({ userId, size = 82, appearance }: { userId: string | null | undefined; size?: number; appearance?: AvatarAppearance }) {
  const outfit = useStartOutfit(userId);
  void appearance;
  return <SizedFigure outfit={outfit} width={size}/>;
}
