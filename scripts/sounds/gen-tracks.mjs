// Generates the bundled snap music loops (assets/sounds/*.mp3). 100% synthesized here — no samples, no third-party
// music, so the tracks are our own and royalty-free. Run: node scripts/sounds/gen-tracks.mjs (needs ffmpeg).
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const SR = 22050, OUT = new URL('../../assets/sounds/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const midi = n => 440 * 2 ** ((n - 69) / 12);
const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const chord = (root, minor) => [root, root + (minor ? 3 : 4), root + 7];
function render({ id, bpm, bars, prog, wave, kick, hat, arp, bass, seconds }) {
  const n = Math.floor(SR * seconds), buf = new Float32Array(n), beat = 60 / bpm, bar = beat * 4;
  const osc = (w, ph) => w === 'saw' ? 2 * (ph % 1) - 1 : w === 'square' ? (ph % 1 < 0.5 ? 0.6 : -0.6) : w === 'tri' ? 1 - 4 * Math.abs((ph % 1) - 0.5) : Math.sin(2 * Math.PI * ph);
  const add = (t0, dur, f, amp, w, att = 0.01, rel = 0.2) => {
    const s0 = Math.floor(t0 * SR), len = Math.floor((dur + rel) * SR);
    for (let i = 0; i < len && s0 + i < n; i++) { const t = i / SR; const env = Math.min(1, t / att) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / rel)); buf[s0 + i] += amp * env * osc(w, f * t); }
  };
  const totalBars = Math.ceil(seconds / bar);
  for (let b = 0; b < totalBars; b++) {
    const [root, minor] = prog[b % prog.length], t0 = b * bar, c = chord(root, minor);
    for (const k of c) add(t0, bar * 0.95, midi(k), 0.06, wave, 0.15, 0.4);           // pad
    if (bass) for (let q = 0; q < 4; q++) add(t0 + q * beat, beat * 0.8, midi(root - 12), 0.12, 'tri', 0.005, 0.05);
    if (arp) for (let e = 0; e < 8; e++) add(t0 + e * beat / 2, beat / 2 * 0.7, midi(c[e % 3] + 12 + (e > 3 ? 12 : 0)), 0.035, 'square', 0.003, 0.08);
    for (let q = 0; q < 4; q++) {
      const tb = t0 + q * beat;
      if (kick && (q % 2 === 0 || kick === 'four')) for (let i = 0; i < SR * 0.18 && Math.floor(tb * SR) + i < n; i++) { const t = i / SR; buf[Math.floor(tb * SR) + i] += 0.5 * Math.exp(-t * 22) * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 40)) * t); }
      if (hat) for (const off of [beat / 2]) { const s0 = Math.floor((tb + off) * SR); for (let i = 0; i < SR * 0.04 && s0 + i < n; i++) buf[s0 + i] += 0.06 * Math.exp(-i / SR * 90) * (Math.random() * 2 - 1); }
    }
  }
  let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const fade = SR * 0.6, pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) { const g = Math.min(1, i / (SR * 0.05), (n - i) / fade); pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] / peak * 0.85 * g)) * 32767), i * 2); }
  const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  const wav = `/tmp/sx-track-${id}.wav`; writeFileSync(wav, Buffer.concat([hdr, pcm]));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '64k', `${OUT}${id}.mp3`]);
  console.log('wrote', id);
}
const N = (l, o = 4) => 12 * (o + 1) + NOTES[l];
render({ id: 'zomerzon', bpm: 118, prog: [[N('C'), 0], [N('G', 3), 0], [N('A', 3), 1], [N('F', 3), 0]], wave: 'tri', kick: 'four', hat: true, arp: true, bass: true, seconds: 16 });
render({ id: 'chill-avond', bpm: 80, prog: [[N('D'), 1], [N('B', 3), 0], [N('G', 3), 0], [N('A', 3), 0]], wave: 'sine', kick: 'half', hat: true, arp: false, bass: true, seconds: 16 });
render({ id: 'straatbeat', bpm: 96, prog: [[N('A', 3), 1], [N('A', 3), 1], [N('F', 3), 0], [N('G', 3), 0]], wave: 'saw', kick: 'four', hat: true, arp: false, bass: true, seconds: 16 });
render({ id: 'droomwolk', bpm: 70, prog: [[N('F'), 0], [N('A'), 1], [N('D'), 1], [N('C'), 0]], wave: 'sine', kick: false, hat: false, arp: true, bass: false, seconds: 16 });
