/** Camera tab without camera access (Snapchat lets you still pick from the camera roll), and camera errors as an
 *  on-screen notice: RN Alert.alert is a no-op on react-native-web, so web users saw nothing when a capture failed. */
export type CameraPermissionLike = { granted?: boolean; canAskAgain?: boolean; status?: string } | null | undefined;
export type CameraGate = { title: string; body: string; action: 'ask' | 'settings' | 'browser' };

export function cameraGate(p: CameraPermissionLike, platform: string): CameraGate {
  const blocked = !!p && p.granted === false && p.canAskAgain === false;
  if (!blocked) return { title: 'Camera toegang nodig 📸', body: 'Sta de camera toe om snaps te maken. Je kunt ook een foto of video uit je galerij kiezen.', action: 'ask' };
  if (platform === 'web') return { title: 'Camera geblokkeerd', body: 'Je browser blokkeert de camera voor Snapshot X. Klik op het slotje naast het adres, zet Camera op Toestaan en laad de pagina opnieuw. Of kies een foto of video.', action: 'browser' };
  return { title: 'Camera staat uit', body: 'Je hebt de camera eerder geweigerd. Zet hem aan in de instellingen van je telefoon, of kies een foto of video uit je galerij.', action: 'settings' };
}

/** Friendly Dutch line for a failed photo/video capture (shown for a few seconds on the preview). */
export function captureErrorText(kind: 'photo' | 'video', e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  const what = kind === 'photo' ? 'Foto maken' : 'Video opnemen';
  if (/permission|denied|notallowed/i.test(raw)) return `${what} lukt niet: geen toegang tot de ${kind === 'photo' ? 'camera' : 'camera of microfoon'}.`;
  if (/not ready|unmounted|not available|notreadable|in use/i.test(raw)) return `${what} lukt niet: de camera is nog niet klaar of wordt door een andere app gebruikt. Probeer het opnieuw.`;
  return `${what} is mislukt. Probeer het opnieuw.`;
}

export const CAPTURE_NOTICE_MS = 4000;
/** Picked camera-roll asset → capture type for the snap editor. */
export const pickedKind = (assetType?: string | null): 'photo' | 'video' => assetType === 'video' ? 'video' : 'photo';
