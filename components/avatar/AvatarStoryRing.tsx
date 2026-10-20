/** Avatar portrait with a story ring (unseen = yellow/pink gradient, seen = grey, none = no ring). Roadmap step 8. */
import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { Outfit } from '../../lib/avatar/outfit';
import { storyRingColors, type StoryRingState } from '../../lib/avatar/poses';
import { WardrobePortrait } from './OwnAvatar';

export function AvatarStoryRing({ outfit, state, size, fallback }: { outfit: Outfit | null | undefined; state: StoryRingState; size: number; fallback?: React.ReactNode }) {
  const gid = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const colors = storyRingColors(state);
  const stroke = Math.max(2, size * 0.05);
  const inner = colors ? size - stroke * 2 - 4 : size;
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} testID={`story-ring:${state}`} accessibilityLabel={state === 'unseen' ? 'Nieuwe story' : state === 'seen' ? 'Story bekeken' : undefined}>
    {colors && <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Defs><LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={colors[0]}/><Stop offset="1" stopColor={colors[1]}/></LinearGradient></Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - stroke / 2} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none"/>
    </Svg>}
    {outfit ? <WardrobePortrait outfit={outfit} size={inner}/> : <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>{fallback}</View>}
  </View>;
}
