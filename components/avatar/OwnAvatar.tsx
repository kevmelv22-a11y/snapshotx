/**
 * The signed-in user's own avatar: the saved avatarkast outfit when there is one,
 * otherwise the classic SnapShot X art (MapAvatar / MapExplorer) driven by the old editor.
 */
import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, RadialGradient, Stop } from 'react-native-svg';
import { useOwnOutfit } from '../../hooks/useWardrobeSync';
import type { AvatarAppearance } from '../../lib/avatar';
import type { Outfit } from '../../lib/avatar/outfit';
import { MapAvatar, MapExplorer } from '../MapAvatar';
import { Avatar3DImage } from '../avatar3d/Avatar3D';
import { ArtImage, bustArtFor, lookArtFor } from './ArtImage';
import { ArmParts, BodyParts, FigureArt, HairBehindParts, HeadParts, LookDefs, MIRROR, OverlayParts, lookFromOutfit } from './AvatarArt';

/** Full-figure crop used for map markers (fits the 82 × 119 MapExplorer footprint; leaves room for long hair). */
export const FIGURE_CROP: [number, number, number, number] = [30, 10, 140, 350];

// Bust crop in avatar coordinates (head centre ≈ 100,70; shoulders ≈ y 120).
const CX = 100, CY = 86, R = 68;

/** Round bust portrait of a wardrobe outfit: 3D snapshot on yellow, 2D art while loading / without WebGL. */
export const WardrobePortrait = React.memo(function WardrobePortrait({ outfit, size, selected = false, label = 'Mijn avatar' }: { outfit: Outfit; size: number; selected?: boolean; label?: string }) {
  const ring = Math.max(2, Math.round(size * 0.045));
  const inner = size - ring * 2;
  const bust = bustArtFor(outfit); // default character art (hair/skin personalisation not reflected)
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: selected ? '#FFE436' : '#E6A2EE', backgroundColor: '#FFE11A', overflow: 'hidden' }} accessibilityLabel={label}>
    {bust ? <ArtImage art={bust} width={inner} height={inner} fit="top" zoom={1.35} offsetY={0.0}/> : <Avatar3DImage outfit={outfit} framing="head" pose="stand" width={inner} height={inner}
      fallback={<View style={{ marginLeft: -ring, marginTop: -ring }}><WardrobePortrait2D outfit={outfit} size={size} selected={selected} label={label}/></View>}/>}
  </View>;
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
  const outfit = useOwnOutfit(userId);
  return outfit ? <WardrobePortrait outfit={outfit} size={size} selected={selected}/> : fallback ?? <MapAvatar id={userId || 'me'} size={size} selected={selected} appearance={appearance}/>;
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
  const outfit = useOwnOutfit(userId);
  return outfit ? <SizedFigure outfit={outfit} width={size}/> : <MapExplorer id={userId || 'me'} own appearance={appearance} size={size}/>;
}
