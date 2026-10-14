/** Mode route (step 8): try curated looks on your avatar; "Meer mode bekijken" opens the full avatarkast. */
import React, { useState } from 'react';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModeScreen } from '../../components/avatar/ModeScreen';
import { useWardrobe } from '../../stores/wardrobe';
import { useAvatarPose } from '../../stores/avatarPose';
import type { Outfit } from '../../lib/avatar/outfit';

export default function ModeRoute() {
  const insets = useSafeAreaInsets();
  const saved = useWardrobe(s => s.history.present);
  const pose = useAvatarPose(s => s.pose);
  const [preview, setPreview] = useState<{ id: string; outfit: Outfit } | null>(null);
  return <>
    <Stack.Screen options={{ headerShown: false }}/>
    <ModeScreen outfit={preview?.outfit ?? saved} pose={pose} selectedLook={preview?.id ?? null}
      onPickLook={(id, outfit) => setPreview(p => p?.id === id ? null : { id, outfit })}
      onMore={() => { if (preview) useWardrobe.getState().apply(preview.outfit); router.push('/avatar/kast'); }}
      onClose={() => router.back()} onTab={t => { if (t !== 'mode') router.push('/avatar/kast'); }}
      topInset={insets.top} bottomInset={insets.bottom}/>
  </>;
}
