import assert from 'node:assert/strict';
import test from 'node:test';
import { mock } from 'node:test';
import { createFriendOutfitCache, createRefreshLoop, FRIEND_OUTFIT_STORAGE_PREFIX, parseFriendRows } from './avatar/friendOutfits.ts';
import { DEFAULT_OUTFIT, parseOutfit } from './avatar/outfit.ts';
import { WARDROBE_ITEMS } from './avatar/wardrobeItems.ts';

const A = '0a1b2c3d-1111-4aaa-8aaa-000000000001';
const B = '0a1b2c3d-2222-4bbb-8bbb-000000000002';
const C = '0a1b2c3d-3333-4ccc-8ccc-000000000003';
const uid = n => `0a1b2c3d-0000-4000-8000-${String(n).padStart(12, '0')}`;
const parse = v => parseOutfit(v, WARDROBE_ITEMS);

/**
 * Manual clock + scheduler so batching/TTL are deterministic. tick() runs the short timers (batch window,
 * storage write) right away; long timers (placeholder timeout) only fire when advance() passes their due time.
 */
function harness(fetchImpl, opts = {}) {
  let t = 1_000;
  let timers = [];
  const calls = [];
  const cache = createFriendOutfitCache(async ids => { calls.push([...ids]); return fetchImpl(ids); }, {
    now: () => t, schedule: (fn, ms) => { timers.push({ fn, ms, due: t + ms }); }, ttlMs: 60_000, retryUnavailableMs: 120_000, ...opts,
  });
  const settle = () => new Promise(r => setImmediate(r));
  const tick = async () => {
    for (;;) {
      const short = timers.filter(x => x.ms < 1_000);
      if (!short.length) break;
      timers = timers.filter(x => x.ms >= 1_000);
      for (const x of short) { x.fn(); await settle(); }
    }
    await settle();
  };
  const advance = async ms => {
    t += ms;
    const due = timers.filter(x => x.ms >= 1_000 && x.due <= t);
    timers = timers.filter(x => !due.includes(x));
    for (const x of due) { x.fn(); await settle(); }
  };
  return { cache, calls, tick, advance, now: () => t };
}

/** AsyncStorage stand-in; getItem resolves after `delayMs` of real time to model async hydration. */
function memoryStorage(initial = {}, delayMs = 0) {
  const data = new Map(Object.entries(initial));
  const wait = () => new Promise(r => setTimeout(r, delayMs));
  return {
    data,
    getItem: async k => { await wait(); return data.has(k) ? data.get(k) : null; },
    setItem: async (k, v) => { data.set(k, v); },
    removeItem: async k => { data.delete(k); },
  };
}

test('requests in the same tick are batched into one RPC call; results are cached', async () => {
  const rows = new Map([[A, { ...DEFAULT_OUTFIT, hairStyle: 'long' }]]);
  const h = harness(async () => rows);
  h.cache.request([A, B]);
  h.cache.request([B, C, A]);
  assert.equal(h.cache.get(A), undefined, 'unknown before the fetch');
  await h.tick();
  assert.deepEqual(h.calls, [[A, B, C]]);
  assert.equal(h.cache.get(A).hairStyle, 'long');
  assert.equal(h.cache.get(B), null, 'friend without an outfit -> null -> classic art');
  h.cache.request([A, B, C]);
  await h.tick();
  assert.equal(h.calls.length, 1, 'fresh entries are not fetched again');
  await h.advance(60_001);
  h.cache.request([A]);
  await h.tick();
  assert.deepEqual(h.calls[1], [A], 'stale entry refetched after the TTL');
});

test('missing RPC/table: nothing cached, classic art stays, and we back off', async () => {
  const h = harness(async () => undefined);
  let notified = 0;
  h.cache.subscribe(() => notified++);
  h.cache.request([A, B]);
  await h.tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.cache.get(A), undefined);
  assert.equal(h.cache.isUnavailable(), true);
  assert.equal(notified, 1, 'one re-render (placeholder -> classic art), no storm');
  h.cache.request([A, B, C]);
  await h.tick();
  assert.equal(h.calls.length, 1, 'no new calls during the back-off');
  await h.advance(120_001);
  h.cache.request([A]);
  await h.tick();
  assert.equal(h.calls.length, 2, 'retried after the back-off');
});

test('a throwing fetcher is treated as unavailable (never throws into the UI)', async () => {
  const h = harness(async () => { throw new Error('offline'); });
  h.cache.request([A]);
  await assert.doesNotReject(h.tick());
  assert.equal(h.cache.get(A), undefined);
  assert.equal(h.cache.isUnavailable(), true);
});

test('non-uuid ids are never sent (they would break the uuid[] RPC); ids are case-insensitive', async () => {
  const h = harness(async ids => new Map(ids.map(id => [id, DEFAULT_OUTFIT])));
  h.cache.request(['me', '', 'demo-aria', null, A.toUpperCase()]);
  await h.tick();
  assert.deepEqual(h.calls, [[A]]);
  assert.ok(h.cache.get(A.toUpperCase()));
  h.cache.request(['me']);
  await h.tick();
  assert.equal(h.calls.length, 1, 'nothing to fetch -> no call');
});

test('more than 200 ids are split into RPC-sized chunks', async () => {
  const h = harness(async ids => new Map(ids.map(id => [id, DEFAULT_OUTFIT])));
  h.cache.request(Array.from({ length: 450 }, (_, i) => uid(i)));
  await h.tick();
  assert.deepEqual(h.calls.map(c => c.length), [200, 200, 50]);
});

test('subscribers are notified once per changed batch', async () => {
  const h = harness(async () => new Map([[A, DEFAULT_OUTFIT]]));
  let n = 0;
  const off = h.cache.subscribe(() => n++);
  const v0 = h.cache.version();
  h.cache.request([A, B]);
  await h.tick();
  assert.equal(n, 1);
  assert.ok(h.cache.version() > v0);
  off();
});

test('parseFriendRows: error -> unavailable, junk rows skipped, outfits validated', () => {
  assert.equal(parseFriendRows(null, { message: 'Could not find the function public.sx_friend_avatar_outfits' }, parse), undefined);
  assert.deepEqual([...parseFriendRows(null, null, parse)], []);
  const rows = parseFriendRows([
    { user_id: A.toUpperCase(), outfit: { hairStyle: 'afro', outerwear: 'bogus-item', colors: { hair: '#1E1A19' } }, updated_at: '2026-10-07T10:00:00Z' },
    { user_id: B, outfit: 'not-an-object' },
    { outfit: {} },
    null,
  ], null, parse);
  assert.deepEqual([...rows.keys()], [A]);
  assert.equal(rows.get(A).hairStyle, 'afro');
  assert.equal(rows.get(A).outerwear, DEFAULT_OUTFIT.outerwear, 'unknown item id falls back');
  assert.equal(rows.get(A).colors.hair, '#1E1A19');
});

// ------------------------------------------------------------------------------------------------------------
// Point 1: persisted per-user cache -> no flash of the classic art after an app start.

const OWNER = 'f0000000-0000-4000-8000-00000000000f';
const OTHER = 'f0000000-0000-4000-8000-0000000000ee';
const KEY = FRIEND_OUTFIT_STORAGE_PREFIX + OWNER;
const ARIA_OUTFIT = { ...DEFAULT_OUTFIT, hairStyle: 'long', colors: { hair: '#2B1B14' } };

/** Records every status a friend goes through, as the UI would see it on each render. */
function trace(cache, id) {
  const seen = [cache.status(id)];
  cache.subscribe(() => { const s = cache.status(id); if (s !== seen[seen.length - 1]) seen.push(s); });
  return seen;
}

test('fetched outfits are persisted per owner (JSON blob under snapshotx.friendOutfits.v1:<userId>)', async () => {
  const storage = memoryStorage();
  const h = harness(async () => new Map([[A, ARIA_OUTFIT]]), { storage, revive: parse });
  await h.cache.setOwner(OWNER);
  h.cache.request([A, C]);
  await h.tick();
  await h.cache.idle();
  const blob = JSON.parse(storage.data.get(KEY));
  assert.equal(blob.v, 1);
  assert.equal(blob.entries[A].o.hairStyle, 'long');
  assert.equal(blob.entries[C].o, null, '"no outfit" is persisted too, so Jules shows the classic art at once');
  assert.equal(storage.data.get(FRIEND_OUTFIT_STORAGE_PREFIX + 'owner'), OWNER);
});

test('app restart: friend with an outfit goes pending -> outfit, NEVER through the classic art', async () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ v: 1, entries: { [A]: { o: ARIA_OUTFIT, at: 500 }, [C]: { o: null, at: 500 } } }) }, 15);
  let release;
  const gate = new Promise(r => { release = r; });
  // The server is slow: the background refresh only answers after we looked at the hydrated state.
  const h = harness(async () => { await gate; return new Map([[A, ARIA_OUTFIT]]); }, { storage, revive: parse });
  const seenA = trace(h.cache, A);
  const seenC = trace(h.cache, C);
  h.cache.request([A, C]); // first render of the friends list (before the session/hydration finished)
  assert.equal(h.cache.status(A), 'pending', 'before hydration: neutral placeholder, not the classic art');
  const hydrating = h.cache.setOwner(OWNER);
  assert.equal(h.cache.status(A), 'pending');
  await hydrating;
  assert.equal(h.cache.status(A), 'outfit', 'stored outfit is on screen right after hydration, before any fetch returns');
  assert.equal(h.cache.get(A).colors.hair, '#2B1B14');
  assert.equal(h.cache.status(C), 'none', 'friend without an outfit: classic art straight from the cache');
  await h.tick();
  assert.deepEqual(h.calls, [[A, C]], 'stale hydrated values are refreshed in the background');
  release();
  await h.tick();
  assert.deepEqual(seenA, ['pending', 'outfit'], 'the classic art never appears for Aria');
  assert.deepEqual(seenC, ['pending', 'none']);
});

test('hydrated values are revalidated in the background even if they were stored only seconds ago', async () => {
  const h = harness(async () => new Map([[A, { ...ARIA_OUTFIT, colors: { hair: '#C9A15A' } }]]), { storage: memoryStorage({ [KEY]: JSON.stringify({ v: 1, entries: { [A]: { o: ARIA_OUTFIT, at: 990 } } }) }), revive: parse });
  await h.cache.setOwner(OWNER);
  assert.equal(h.cache.get(A).colors.hair, '#2B1B14', 'stored value first');
  h.cache.request([A]);
  await h.tick();
  assert.equal(h.calls.length, 1, 'refetched although only 10 ms old');
  assert.equal(h.cache.get(A).colors.hair, '#C9A15A');
  h.cache.request([A]);
  await h.tick();
  assert.equal(h.calls.length, 1, 'after that the normal 60 s TTL applies');
});

test('cold start without a stored value: placeholder until the first fetch; classic only after maxPendingMs', async () => {
  const fast = harness(async () => new Map([[A, ARIA_OUTFIT]]), { storage: memoryStorage(), revive: parse });
  const seen = trace(fast.cache, A);
  await fast.cache.setOwner(OWNER);
  fast.cache.request([A]);
  await fast.tick();
  assert.deepEqual(seen, ['pending', 'outfit']);

  const slow = harness(() => new Promise(() => {}), { storage: memoryStorage(), revive: parse, maxPendingMs: 4_000 });
  await slow.cache.setOwner(OWNER);
  slow.cache.request([B]);
  await slow.tick();
  assert.equal(slow.cache.status(B), 'pending');
  await slow.advance(3_999);
  assert.equal(slow.cache.status(B), 'pending');
  let renders = 0;
  slow.cache.subscribe(() => renders++);
  await slow.advance(2);
  assert.equal(slow.cache.status(B), 'none', 'network hangs: fall back to the classic art after 4 s');
  assert.equal(renders, 1, 'the timeout triggers a re-render');
});

test('logout clears memory and removes the stored blob (+ owner marker)', async () => {
  const storage = memoryStorage();
  const h = harness(async () => new Map([[A, ARIA_OUTFIT]]), { storage, revive: parse });
  await h.cache.setOwner(OWNER);
  h.cache.request([A]);
  await h.tick();
  await h.cache.idle();
  assert.ok(storage.data.has(KEY));
  await h.cache.setOwner(null);
  assert.equal(h.cache.get(A), undefined);
  assert.equal(storage.data.has(KEY), false);
  assert.equal(storage.data.has(FRIEND_OUTFIT_STORAGE_PREFIX + 'owner'), false);
});

test('a logout that never reached storage (app killed) is cleaned up on the next start', async () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ v: 1, entries: { [A]: { o: ARIA_OUTFIT, at: 500 } } }), [FRIEND_OUTFIT_STORAGE_PREFIX + 'owner']: OWNER });
  const h = harness(async () => new Map(), { storage, revive: parse });
  await h.cache.setOwner(null); // started signed out
  assert.equal(storage.data.has(KEY), false);
});

test('switching account: previous owner\'s outfits are dropped and never shown to the new owner', async () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ v: 1, entries: { [A]: { o: ARIA_OUTFIT, at: 500 } } }) });
  const h = harness(async () => new Map(), { storage, revive: parse });
  await h.cache.setOwner(OWNER);
  assert.equal(h.cache.status(A), 'outfit');
  await h.cache.setOwner(OTHER);
  assert.equal(h.cache.get(A), undefined);
  assert.equal(storage.data.has(KEY), false);
});

test('prune(friendIds) drops unfriended people from memory and storage (also entries that hydrate later)', async () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ v: 1, entries: { [A]: { o: ARIA_OUTFIT, at: 500 }, [B]: { o: ARIA_OUTFIT, at: 500 } } }) }, 5);
  const h = harness(async () => new Map(), { storage, revive: parse });
  const hydrating = h.cache.setOwner(OWNER);
  h.cache.prune([A]); // friend list loaded before the blob was read
  await hydrating;
  await h.tick();
  await h.cache.idle();
  assert.equal(h.cache.status(A), 'outfit');
  assert.equal(h.cache.get(B), undefined, 'B is no longer a friend');
  assert.deepEqual(Object.keys(JSON.parse(storage.data.get(KEY)).entries), [A]);
  h.cache.prune([]);
  await h.tick();
  await h.cache.idle();
  assert.deepEqual(JSON.parse(storage.data.get(KEY)).entries, {});
});

test('corrupt or invalid stored data is ignored instead of crashing', async () => {
  const bad = memoryStorage({ [KEY]: '{not json' });
  const h1 = harness(async () => new Map(), { storage: bad, revive: parse });
  await assert.doesNotReject(h1.cache.setOwner(OWNER));
  assert.equal(h1.cache.isHydrated(), true);
  const odd = memoryStorage({ [KEY]: JSON.stringify({ v: 1, entries: { [A]: { o: { hairStyle: 'afro' }, at: 500 }, 'not-a-uuid': { o: {}, at: 500 }, [B]: { o: {}, at: 'x' } } }) });
  const h2 = harness(async () => new Map(), { storage: odd, revive: parse });
  await h2.cache.setOwner(OWNER);
  assert.equal(h2.cache.get(A).hairStyle, 'afro', 'stored outfits go through parseOutfit');
  assert.equal(h2.cache.get(B), undefined);
});

// ------------------------------------------------------------------------------------------------------------
// Point 2: faster refresh (TTL 60 s, focus/foreground, 60 s polling paused in the background). Real timer APIs
// replaced by node:test fake timers (setTimeout/setInterval/Date).

test('refresh loop: runs on focus, every 60 s while focused+foreground, never in the background', () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    let runs = 0;
    const loop = createRefreshLoop(() => runs++, { intervalMs: 60_000 });
    loop.setFocused(true);
    assert.equal(runs, 1, 'screen focus -> immediate refresh');
    mock.timers.tick(59_999); assert.equal(runs, 1);
    mock.timers.tick(1); assert.equal(runs, 2, 'poll after 60 s');
    loop.setForeground(false);
    mock.timers.tick(10 * 60_000); assert.equal(runs, 2, 'paused in the background (interval cleared)');
    assert.equal(loop.isRunning(), false);
    loop.setForeground(true);
    assert.equal(runs, 3, 'back to the foreground -> immediate refresh');
    mock.timers.tick(60_000); assert.equal(runs, 4);
    loop.setFocused(false);
    mock.timers.tick(5 * 60_000); assert.equal(runs, 4, 'screen blurred -> no polling');
    loop.setFocused(true); assert.equal(runs, 5);
    loop.stop();
    mock.timers.tick(5 * 60_000); assert.equal(runs, 5);
  } finally { mock.timers.reset(); }
});

/** End-to-end: real cache (default scheduler + Date.now) + refresh loop, all on fake timers. */
async function liveScenario(run) {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: Date.parse('2026-10-07T12:00:00Z') });
  const flushMicro = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  try {
    const server = new Map([[A, { ...ARIA_OUTFIT }]]);
    const calls = [];
    const cache = createFriendOutfitCache(async ids => { calls.push(Date.now()); return new Map(ids.filter(id => server.has(id)).map(id => [id, structuredClone(server.get(id))])); }, { revive: parse });
    const loop = createRefreshLoop(() => cache.refresh([A]), { intervalMs: 60_000 });
    const step = async ms => { mock.timers.tick(ms); await flushMicro(); };
    /** Advances in 100 ms steps until the friend's hair colour on "screen" is `hair`; returns the elapsed ms. */
    const waitForHair = async (hair, limitMs) => {
      const start = Date.now();
      while (Date.now() - start <= limitMs) { if (cache.get(A)?.colors?.hair === hair) return Date.now() - start; await step(100); }
      return Infinity;
    };
    await run({ server, calls, cache, loop, step, waitForHair });
  } finally { mock.timers.reset(); }
}

test('a friend\'s changed outfit is on screen within 60 s (+30 ms batch) while the screen is open', async () => {
  await liveScenario(async ({ server, cache, loop, step, waitForHair }) => {
    cache.request([A]);
    loop.setFocused(true);
    await step(100);
    assert.equal(cache.get(A).colors.hair, '#2B1B14');
    // Worst case: the friend saves right after a poll.
    await step(200);
    server.set(A, { ...ARIA_OUTFIT, colors: { hair: '#C9A15A' } });
    const ms = await waitForHair('#C9A15A', 61_000);
    assert.ok(ms <= 60_100, `updated after ${ms} ms (limit 60 s + batch window)`);
    assert.ok(ms >= 59_000, 'it really came from the 60 s poll, not something faster we did not intend');
  });
});

test('without polling the 60 s TTL alone also refreshes on the next request', async () => {
  await liveScenario(async ({ server, cache, step, calls }) => {
    cache.request([A]);
    await step(100);
    server.set(A, { ...ARIA_OUTFIT, colors: { hair: '#A8512C' } });
    await step(30_000);
    cache.request([A]); await step(100);
    assert.equal(calls.length, 1, 'fresh for 60 s');
    await step(30_000);
    cache.request([A]); await step(100);
    assert.equal(calls.length, 2);
    assert.equal(cache.get(A).colors.hair, '#A8512C');
  });
});

test('background: no fetches at all; returning to the foreground shows the change within the batch window', async () => {
  await liveScenario(async ({ server, calls, loop, step, waitForHair }) => {
    loop.setFocused(true);
    await step(100);
    loop.setForeground(false);
    const before = calls.length;
    server.set(A, { ...ARIA_OUTFIT, colors: { hair: '#1E1A19' } });
    await step(30 * 60_000);
    assert.equal(calls.length, before, 'nothing polled while in the background');
    loop.setForeground(true);
    const ms = await waitForHair('#1E1A19', 1_000);
    assert.ok(ms <= 100, `visible ${ms} ms after returning to the foreground`);
  });
});

test('focus refresh is throttled: refocusing within 5 s does not refetch', async () => {
  await liveScenario(async ({ calls, loop, step }) => {
    loop.setFocused(true); await step(100);
    loop.setFocused(false); loop.setFocused(true); await step(100);
    assert.equal(calls.length, 1);
    await step(5_000);
    loop.setFocused(false); loop.setFocused(true); await step(100);
    assert.equal(calls.length, 2);
  });
});
