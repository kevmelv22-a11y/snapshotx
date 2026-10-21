import assert from 'node:assert/strict';
import test from 'node:test';
import { staffHeaderLayout, STAFF_WIDE_MIN } from './staff-layout.ts';

test('desktop keeps the sidebar and full profile pill', () => {
  assert.deepEqual(staffHeaderLayout(1280), { wide: true, profile: 'full', gap: 12, padding: 18 });
  assert.equal(staffHeaderLayout(STAFF_WIDE_MIN).wide, true);
  assert.equal(staffHeaderLayout(STAFF_WIDE_MIN - 1).wide, false);
});

test('narrow phones collapse the profile pill so the title is never overlapped', () => {
  assert.equal(staffHeaderLayout(700).profile, 'full');
  assert.equal(staffHeaderLayout(473).profile, 'role');
  assert.equal(staffHeaderLayout(390).profile, 'icon');
  assert.equal(staffHeaderLayout(320).profile, 'icon');
});

test('unknown/zero width falls back to a phone layout', () => {
  assert.equal(staffHeaderLayout(0).profile, 'icon');
  assert.equal(staffHeaderLayout(Number.NaN).wide, false);
});
