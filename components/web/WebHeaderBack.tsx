import React from 'react';
import {Pressable, Text, type ColorValue} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {webBackAction, webBackLabel} from '../../lib/web-back';

/** headerLeft for root-stack screens on web: back with history, else to Chat (lib/web-back.ts). */
export function WebHeaderBack({canGoBack, tintColor}: {canGoBack?: boolean; tintColor?: ColorValue}) {
  const go = () => { const a = webBackAction(canGoBack); if (a === 'back') router.back(); else router.replace(a); };
  return <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={webBackLabel(canGoBack)} testID="web-header-back" style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4}}>
    <Ionicons name="chevron-back" size={24} color={tintColor ?? '#fff'}/>
    {!canGoBack && <Text style={{color: tintColor ?? '#fff', fontWeight: '700', marginLeft: 2}}>Chat</Text>}
  </Pressable>;
}
