import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { G } from 'react-native-svg';
import type { Outfit } from '../../lib/avatar/outfit';
import { ArmParts, BodyParts, HairBehindParts, hasHairBehind, HeadParts, LayerSvg, lookFromOutfit, MIRROR, OverlayParts, type Expression, type Gaze, type HandPose } from './AvatarArt';

export type ReactionKind = 'wave' | 'cheer' | 'peace' | 'nod' | 'shrug';
export const REACTIONS: ReactionKind[] = ['wave', 'cheer', 'peace', 'nod', 'shrug'];
export type Reaction = { kind: ReactionKind; key: number } | null;

const native = Platform.OS !== 'web';
const VB_W = 200, VB_H = 400;

function pivot(value: Animated.Value, px: number, py: number, k: number) {
  const dx = (px - VB_W / 2) * k, dy = (py - VB_H / 2) * k;
  const rotate = value.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
  return { transform: [{ translateX: dx }, { translateY: dy }, { rotate }, { translateX: -dx }, { translateY: -dy }] };
}

const t = (v: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.quad)) =>
  Animated.timing(v, { toValue, duration, easing, useNativeDriver: native });

/** Full-body avatar built from layered SVGs; arms and head are separate layers so they can animate. */
export function WardrobeAvatar({ outfit, width, reaction }: { outfit: Outfit; width: number; reaction: Reaction }) {
  const look = useMemo(() => lookFromOutfit(outfit), [outfit]);
  const k = width / VB_W;
  const height = width * 2;
  const [armL] = useState(() => new Animated.Value(0));
  const [armR] = useState(() => new Animated.Value(0));
  const [head] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  // Facial expression / hand pose follow the active reaction until its 2 s timer marks it done.
  const [doneKey, setDoneKey] = useState<number | null>(null);
  const live = reaction && reaction.key !== doneKey ? reaction.kind : null;
  const expression: Expression = live ? 'smile' : 'neutral';
  const gaze: Gaze = live === 'nod' ? 'down' : live === 'shrug' ? 'side' : 'front';
  const poseR: HandPose = live === 'peace' ? 'peace' : 'rest';

  // Subtle idle breathing.
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([t(bob, -1.2, 1600), t(bob, 0, 1600)]));
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    if (!reaction) return;
    const { kind, key } = reaction;
    let anim: Animated.CompositeAnimation;
    if (kind === 'wave') anim = Animated.parallel([
      Animated.sequence([t(armL, 140, 260), t(armL, 118, 170), t(armL, 146, 170), t(armL, 118, 170), t(armL, 146, 170), t(armL, 125, 170), t(armL, 0, 380)]),
      Animated.sequence([t(head, -5, 300), Animated.delay(1100), t(head, 0, 300)]),
    ]);
    else if (kind === 'cheer') anim = Animated.parallel([
      Animated.sequence([Animated.parallel([t(armL, 152, 280), t(armR, -152, 280)]), Animated.delay(150), Animated.parallel([t(armL, 138, 180), t(armR, -138, 180)]), Animated.parallel([t(armL, 152, 180), t(armR, -152, 180)]), Animated.delay(600), Animated.parallel([t(armL, 0, 380), t(armR, 0, 380)])]),
    ]);
    else if (kind === 'peace') anim = Animated.parallel([
      Animated.sequence([t(armR, -166, 320), Animated.delay(1200), t(armR, 0, 380)]),
      Animated.sequence([t(head, 7, 320), Animated.delay(1200), t(head, 0, 380)]),
    ]);
    else if (kind === 'nod') anim = Animated.parallel([
      Animated.sequence([t(head, 5, 260), t(head, -2, 240), t(head, 5, 240), Animated.delay(700), t(head, 0, 320)]),
      Animated.sequence([t(armL, 10, 300), Animated.delay(1300), t(armL, 0, 300)]),
      Animated.sequence([t(armR, -10, 300), Animated.delay(1300), t(armR, 0, 300)]),
    ]);
    else anim = Animated.parallel([
      Animated.sequence([Animated.parallel([t(armL, 24, 260), t(armR, -24, 260), t(head, -8, 260)]), Animated.delay(1200), Animated.parallel([t(armL, 0, 360), t(armR, 0, 360), t(head, 0, 360)])]),
    ]);
    anim.start();
    const done = setTimeout(() => setDoneKey(key), 2000);
    return () => { anim.stop(); clearTimeout(done); armL.setValue(0); armR.setValue(0); head.setValue(0); };
  }, [reaction, armL, armR, head]);

  const layer = (children: (ctx: Parameters<typeof BodyParts>[0]['ctx']) => React.ReactNode) =>
    <LayerSvg look={look} width={width} height={height}>{children}</LayerSvg>;

  return <Animated.View style={{ width, height, transform: [{ translateY: bob }] }} pointerEvents="none">
    {/* Long/wavy hair hangs behind the body but turns with the head, so it uses the head pivot. */}
    {hasHairBehind(look) && <Animated.View style={[StyleSheet.absoluteFill, pivot(head, 100, 108, k)]}>{layer(ctx => <HairBehindParts ctx={ctx}/>)}</Animated.View>}
    <View style={StyleSheet.absoluteFill}>{layer(ctx => <BodyParts ctx={ctx}/>)}</View>
    <Animated.View style={[StyleSheet.absoluteFill, pivot(head, 100, 108, k)]}>{layer(ctx => <HeadParts ctx={ctx} expression={expression} gaze={gaze}/>)}</Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, pivot(armL, 69.5, 126, k)]}>{layer(ctx => <ArmParts ctx={ctx} side="L"/>)}</Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, pivot(armR, 130.5, 126, k)]}>{layer(ctx => <G transform={MIRROR}><ArmParts ctx={ctx} side="R" pose={poseR}/></G>)}</Animated.View>
    <View style={StyleSheet.absoluteFill}>{layer(ctx => <OverlayParts ctx={ctx}/>)}</View>
  </Animated.View>;
}
