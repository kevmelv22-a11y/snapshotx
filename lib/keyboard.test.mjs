import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chatKeyboardOffset, kavBehavior } from './keyboard.ts';

test('keyboard: padding on iOS and edge-to-edge Android, nothing on web; chat offset only on iOS', () => {
  assert.equal(kavBehavior('ios'), 'padding');
  assert.equal(kavBehavior('android'), 'padding');
  assert.equal(kavBehavior('web'), undefined);
  assert.equal(chatKeyboardOffset('ios'), 90);
  assert.equal(chatKeyboardOffset('android'), 0);
});

test('no KeyboardAvoidingView leaves Android without a behaviour (input would sit under the keyboard)', () => {
  const root = new URL('..', import.meta.url).pathname, hits = [];
  const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx$/.test(f)) hits.push(p); } };
  walk(join(root, 'app')); walk(join(root, 'components'));
  let n = 0;
  for (const p of hits) {
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(/<KeyboardAvoidingView\b[^>]*>/g)) {
      n++;
      assert.match(m[0], /behavior=\{kavBehavior\(Platform\.OS\)\}/, p);
    }
  }
  assert.ok(n >= 8, `expected the 8 known keyboard screens, found ${n}`);
});
