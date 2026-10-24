import assert from 'node:assert/strict';
import test from 'node:test';
import { readMediaBytes, MediaReadError } from './media-bytes.ts';
import { friendlyError } from './db-errors.ts';

const buf = n => new Uint8Array(n).fill(7).buffer;
// Exactly what the iPhone showed (Hermes wording) when the File base class lacks validatePath.
const hermes = new TypeError("this.validatePath is not a function. (In 'this.validatePath()', 'this.validatePath' is undefined)");
// Mirrors expo-file-system's File: the constructor calls a base-class method.
class Base {}
class FakeFile extends Base { constructor(uri) { super(); this.uri = uri; this.validatePath(); } async arrayBuffer() { return buf(3); } }

test('falls back to fetch when expo File cannot be constructed (validatePath missing)', async () => {
  let fetched = '';
  const bytes = await readMediaBytes('file:///var/mobile/photo.jpg', {
    platform: 'ios', readWithFile: async u => new FakeFile(u).arrayBuffer(), fetchBytes: async u => { fetched = u; return buf(5); },
  });
  assert.equal(bytes.byteLength, 5);
  assert.equal(fetched, 'file:///var/mobile/photo.jpg');
});

test('uses expo File first on native file:// URIs, and only as an instance', async () => {
  let fetches = 0;
  const bytes = await readMediaBytes('file:///a.m4a', { platform: 'ios', readWithFile: async () => buf(9), fetchBytes: async () => { fetches++; return buf(1); } });
  assert.equal(bytes.byteLength, 9); assert.equal(fetches, 0);
});

test('web and blob: URIs never construct an expo File', async () => {
  let fileCalls = 0;
  for (const [platform, uri] of [['web', 'blob:http://x/1'], ['ios', 'ph://ABC']]) {
    await readMediaBytes(uri, { platform, readWithFile: async () => { fileCalls++; return buf(1); }, fetchBytes: async () => buf(2) });
  }
  assert.equal(fileCalls, 0);
});

test('legacy base64 read is the last native fallback', async () => {
  const bytes = await readMediaBytes('file:///v.mp4', { platform: 'android', readWithFile: async () => { throw hermes; }, fetchBytes: async () => { throw new TypeError('Network request failed'); }, readBase64: async () => 'AAEC', decodeBase64: () => buf(3) });
  assert.equal(bytes.byteLength, 3);
});

test('all readers failing gives a MediaReadError with a Dutch friendly text', async () => {
  await assert.rejects(readMediaBytes('file:///x', { platform: 'ios', readWithFile: async () => { throw hermes; } }), MediaReadError);
  const e = await readMediaBytes('file:///x', { platform: 'ios', readWithFile: async () => { throw hermes; } }).catch(x => x);
  assert.match(friendlyError(e), /kon niet worden gelezen/);
});

test('the raw validatePath / JS internal errors are never shown in chat', () => {
  assert.doesNotMatch(friendlyError(hermes), /validatePath|undefined|function/);
  assert.match(friendlyError(hermes), /kon niet worden gelezen/);
  assert.equal(friendlyError(new TypeError("undefined is not an object (evaluating 'a.b')")), 'Er ging iets mis. Probeer het opnieuw.');
  assert.equal(friendlyError(new Error('Log opnieuw in.')), 'Log opnieuw in.');
});

test('lib/media.ts reads through readMediaBytes and never detaches File methods', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('./media.ts', import.meta.url), 'utf8');
  assert.match(src, /readMediaBytes\(/);
  assert.doesNotMatch(src, /\{\s*(arrayBuffer|bytes|text|base64)\s*\}\s*=|\.then\(\s*\w+\.(arrayBuffer|bytes|text)\s*\)|File\.prototype/);
});
