import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** Snapshot X wordmark (neon X + "SNAPSHOT X"), transparent PNG, aspect 900:186. */
export const WORDMARK_ASPECT = 900 / 186;

export function BrandWordmark({ height = 28, style }: { height?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={require('../assets/snapshotx-wordmark.png')} style={[{ height, width: Math.round(height * WORDMARK_ASPECT), maxWidth: '100%' }, style]}
    resizeMode="contain" accessibilityRole="header" accessibilityLabel="SnapShot X" testID="brand-wordmark"/>;
}
