import jsQR from 'jsqr';
/** Web only: decode a QR code from an uploaded/taken photo (works on every browser, incl. iOS Safari without BarcodeDetector). */
export async function decodeQrFile(file: Blob): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('image')); i.src = url; });
    for (const max of [1200, 800, 2000]) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
      if (hit?.data) return hit.data;
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}
/** Opens the browser file picker (on phones: camera or gallery) and decodes the chosen picture. */
export function pickAndDecodeQr(): Promise<string | null | 'cancel'> {
  return new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => { const f = input.files?.[0]; if (!f) return resolve('cancel'); try { resolve(await decodeQrFile(f)); } catch { resolve(null); } };
    input.click();
  });
}
export const liveScanSupported = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;
