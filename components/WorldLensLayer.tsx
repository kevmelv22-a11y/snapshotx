import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FaceFilterOverlay } from './FaceFilterOverlay';
import type { PhotoFilterId } from '../lib/photo-filters';

/** ~30 fps animation clock (ms since mount); stops when disabled. */
export function useLensClock(enabled: boolean, fps = 30): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const start = Date.now();
    let raf = 0, last = 0;
    const tick = () => {
      const t = Date.now() - start;
      if (t - last >= 1000 / fps) { last = t; setNow(t); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, fps]);
  return now;
}

/**
 * Face-free world lens (confetti, snow, hearts) over any camera preview: works with the rear camera,
 * without face detection, on web, and stays on screen while a video is being recorded.
 */
export function WorldLensLayer({ filterId, active = true }: { filterId: PhotoFilterId; active?: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const now = useLensClock(active);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    <FaceFilterOverlay filterId={filterId} face={null} width={size.width} height={size.height} nowMs={now} live />
  </View>;
}
