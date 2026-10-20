/**
 * Reads a picked / recorded media URI into bytes for the Supabase Storage upload.
 * Pure (dependencies injected) so the fallbacks run under `npx tsx --test`.
 *
 * Why: `new File(uri)` from expo-file-system (SDK 57 API) calls `this.validatePath()` in its constructor, a
 * method of the NATIVE base class. Where that base class lacks it (web build, a native binary whose
 * ExpoFileSystem module doesn't match the JS package, a non-file:// URI such as blob:/ph://), the constructor
 * throws "this.validatePath is not a function", which chat showed raw under the messages.
 * Order: expo File (file:// on native) → fetch(uri).arrayBuffer() → legacy readAsStringAsync(base64).
 */
export type ByteReaders = {
  platform: string;
  /** `new File(uri).arrayBuffer()`, always on a constructed instance (never a detached method). */
  readWithFile?: (uri: string) => Promise<ArrayBuffer>;
  fetchBytes?: (uri: string) => Promise<ArrayBuffer>;
  readBase64?: (uri: string) => Promise<string>;
  decodeBase64?: (b64: string) => ArrayBuffer;
};

export class MediaReadError extends Error {
  constructor(public causes: unknown[]) { super('Bestand kon niet worden gelezen.'); this.name = 'MediaReadError'; }
}

const isFileUri = (uri: string) => /^file:\/\//i.test(uri) || uri.startsWith('/');

export async function readMediaBytes(uri: string, r: ByteReaders): Promise<ArrayBuffer> {
  const causes: unknown[] = [];
  const attempts: (() => Promise<ArrayBuffer>)[] = [];
  if (r.platform !== 'web' && isFileUri(uri) && r.readWithFile) attempts.push(() => r.readWithFile!(uri));
  if (r.fetchBytes) attempts.push(() => r.fetchBytes!(uri));
  if (r.platform !== 'web' && r.readBase64 && r.decodeBase64) attempts.push(async () => r.decodeBase64!(await r.readBase64!(uri)));
  for (const attempt of attempts) {
    try {
      const bytes = await attempt();
      if (bytes && bytes.byteLength > 0) return bytes;
      causes.push(new Error('empty'));
    } catch (e) { causes.push(e); }
  }
  throw new MediaReadError(causes);
}
