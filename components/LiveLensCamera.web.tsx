import { useEffect, type Ref } from 'react';
import type { PhotoFilterId } from '../lib/photo-filters';

export type LiveLensCameraHandle = { takePhoto(flash: 'on' | 'off' | 'auto'): Promise<string>; recordVideo(maxDurationS: number): Promise<string>; stopRecording(): Promise<void> };

type Props = {
  facing: 'front' | 'back';
  zoom: number;
  active: boolean;
  filterId: PhotoFilterId;
  onUnavailable: (reason: string) => void;
  ref?: Ref<LiveLensCameraHandle>;
};

/** Web has no VisionCamera / ML Kit: report unavailable so the camera screen keeps expo-camera + hint. */
export function LiveLensCamera({ onUnavailable }: Props) {
  useEffect(() => { onUnavailable('Live lenzen zijn niet beschikbaar op web.'); }, [onUnavailable]);
  return null;
}
