#!/usr/bin/env node
/**
 * Real (non-demo) web export for snapshot-x.nl. Reads the env (.env + shell), refuses demo flags or secret keys
 * (lib/web-env.ts), exports to dist-web-real/ and scans the bundle for leaked secrets. It never deploys:
 * after checking, a PREVIEW deploy is `npx eas-cli deploy --export-dir dist-web-real` (no --prod) — see docs/web/WEB_NL.md.
 *   node --experimental-strip-types scripts/web/export-web-real.mjs [--check]   (or: npx tsx scripts/web/export-web-real.mjs)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bundleLeaks, realWebEnvProblems } from '../../lib/web-env.ts';
import { wellKnownFiles } from '../../lib/universal-links.ts';

const env = { ...process.env };
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const problems = realWebEnvProblems(env);
if (problems.length) { console.error('Echte webbuild geblokkeerd:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Env OK voor de echte webversie (geen demo, publishable key).');
const wk = wellKnownFiles(env);
for (const n of wk.notes) console.log('Universal links: ' + n);
if (process.argv.includes('--check')) process.exit(0);

const OUT = 'dist-web-real';
const r = spawnSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', OUT], { stdio: 'inherit', env });
if (r.status !== 0) process.exit(r.status ?? 1);
const files = []; const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p) } };
walk(OUT);
const leaks = files.flatMap(f => bundleLeaks(readFileSync(f, 'utf8')).map(l => `${f}: ${l}`));
if (leaks.length) { console.error('Bundle afgekeurd:\n- ' + leaks.join('\n- ')); process.exit(1); }
// Universal links: AASA (no extension, JSON) / assetlinks.json — only when the env has Kevin's real team id / cert.
for (const f of wk.files) { const p = join(OUT, f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(f.json)); console.log('Geschreven: ' + p); }
console.log(`Klaar: ${OUT}/ (${files.length} JS-bestanden, geen geheimen gevonden). Preview: npx eas-cli deploy --export-dir ${OUT}  (zonder --prod)`);
