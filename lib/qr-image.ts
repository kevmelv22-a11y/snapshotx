/** Native: the expo-camera scanner handles QR codes; photo decoding is a web-only fallback. */
export async function pickAndDecodeQr(): Promise<string | null | 'cancel'> { return 'cancel'; }
export const liveScanSupported = () => true;
