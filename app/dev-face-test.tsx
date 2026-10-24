import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../stores/app';
import { PHOTO_FILTERS, type PhotoFilterId } from '../lib/photo-filters';
import type { FaceGeometry } from '../lib/face-filters/types';

/**
 * DEV-ONLY test harness (redirects away in release builds). Opens the real "Jouw Snap" editor with a
 * still photo and injected face landmarks, so the face-filter rendering can be checked without a camera
 * (simulator / web). `img` = photo URL, `lm` = URL of {image:{width,height}, face: FaceGeometry|null}.
 */
export default function DevFaceTest() {
  const { img, lm, filter } = useLocalSearchParams<{ img?: string; lm?: string; filter?: string }>();
  const setCapture = useApp((s) => s.setCapture);
  const [status, setStatus] = useState('Testfoto laden…');
  useEffect(() => {
    if (!__DEV__ || !img) return;
    let active = true;
    (async () => {
      let face: FaceGeometry | null | undefined;
      let imageSize: { width: number; height: number } | undefined;
      if (lm) {
        const data = (await (await fetch(lm)).json()) as { image?: { width: number; height: number }; face?: FaceGeometry | null };
        face = data.face ?? null;
        imageSize = data.image;
      }
      const filterId = (PHOTO_FILTERS.some((f) => f.id === filter) ? filter : 'balaclava') as PhotoFilterId;
      if (!active) return;
      setCapture({ uri: img, type: 'photo', filterId, face, imageSize });
      router.replace('/compose');
    })().catch((e: unknown) => setStatus(String(e)));
    return () => { active = false; };
  }, [img, lm, filter, setCapture]);
  if (!__DEV__) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: '#08090E', justifyContent: 'center', padding: 24 }}>
    <Text style={{ color: 'white' }}>{img ? status : 'Geef ?img=…&lm=… mee.'}</Text>
  </View>;
}
