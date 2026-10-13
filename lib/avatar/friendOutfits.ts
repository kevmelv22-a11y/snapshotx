/**
 * Friends' saved avatarkast outfits: batched fetch + cache, persisted per signed-in user (pure, no runtime
 * imports, so it runs under `node --test`; the Supabase RPC call and the storage are injected, see
 * lib/avatar/outfitSync.ts and hooks/useFriendOutfits.ts).
 *
 * Contract for the UI (see hooks/useFriendOutfits.ts):
 *   status(id) === 'outfit'  -> render get(id)
 *   status(id) === 'none'    -> render the classic friend art (no outfit / sync unavailable / not a uuid / timed out)
 *   status(id) === 'pending' -> render a NEUTRAL placeholder: the persisted cache is still hydrating or the first
 *                               fetch for this friend is underway (at most `maxPendingMs`, then 'none').
 * The placeholder is what prevents the "classic art -> outfit" flash right after an app start.
 *
 * Persistence: one JSON blob per owner (`snapshotx.friendOutfits.v1:<userId>`). setOwner(null) (logout) clears the
 * memory AND removes the previous owner's blob; switching owners does the same before hydrating the new one.
 * prune(friendIds) drops entries for people that are no longer friends (memory + storage). Hydrated values are
 * shown immediately and are always revalidated by the first request of the session (background refresh),
 * however recently they were stored.
 *
 * When the RPC/table is missing (migration not applied, offline, ...) the fetcher returns undefined: nothing new
 * is cached, the classic art stays, and we back off instead of hammering the server. The single console warning
 * is emitted by the fetcher (outfitSync warnOnce), never here.
 */

/** undefined = sync unavailable (already warned by the caller); Map = rows that exist (missing id = no outfit). */
export type FriendOutfitFetcher<T> = (ids: string[]) => Promise<Map<string, T> | undefined>;

/** AsyncStorage-compatible subset (AsyncStorage on native, localStorage-backed on web). */
export type FriendOutfitStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type FriendOutfitStatus = 'outfit' | 'none' | 'pending';

export type FriendOutfitCacheOptions<T> = {
  /** How long a fetched value (outfit or "none") is fresh; request() refetches after this. */
  ttlMs?: number;
  /** refresh() (focus / foreground / polling) skips ids fetched less than this long ago. */
  minRefreshMs?: number;
  /** Back-off after the RPC turned out to be unavailable. */
  retryUnavailableMs?: number;
  /** Requests made within this window are merged into one RPC call. */
  batchDelayMs?: number;
  /** Server limit of sx_friend_avatar_outfits(uuid[]) (max 200 ids per call). */
  maxBatch?: number;
  /** Longest time an id shows the neutral placeholder before falling back to the classic art. */
  maxPendingMs?: number;
  storage?: FriendOutfitStorage;
  storagePrefix?: string;
  /** Persisted entries older than this are ignored when hydrating. */
  maxStoredAgeMs?: number;
  /** Validates a persisted outfit (throw / return null to drop it). */
  revive?: (raw: unknown) => T | null;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
};

export type FriendOutfitCache<T> = {
  get: (id: string) => T | null | undefined;
  status: (id: string) => FriendOutfitStatus;
  /** Queues ids that are unknown or older than the TTL; one batched fetch follows shortly. Never throws. */
  request: (ids: readonly string[]) => void;
  /** Like request(), but also refetches fresh ids unless fetched within `minRefreshMs` (focus/foreground/poll). */
  refresh: (ids: readonly string[]) => void;
  /** Runs the queued fetch now (also used by tests). */
  flush: () => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  /** Bumped whenever what status()/get() return may have changed (for useSyncExternalStore). */
  version: () => number;
  isUnavailable: () => boolean;
  /** Sets the signed-in user: hydrates their persisted cache; null = logout (memory + storage cleared). */
  setOwner: (owner: string | null) => Promise<void>;
  owner: () => string | null | undefined;
  isHydrated: () => boolean;
  /** Keeps only these ids (the current friend list); others are dropped from memory and storage. */
  prune: (keepIds: readonly string[]) => void;
  /** Resolves when pending storage writes are done (tests). */
  idle: () => Promise<void>;
  clear: () => void;
};

/** Supabase auth ids are uuids; anything else (demo rows, 'me', ...) would make the uuid[] RPC fail. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FRIEND_OUTFIT_STORAGE_PREFIX = 'snapshotx.friendOutfits.v1:';

type Entry<T> = { value: T | null; at: number };
type Stored = { v: 1; entries: Record<string, { o: unknown; at: number }> };

export function createFriendOutfitCache<T>(fetcher: FriendOutfitFetcher<T>, opts: FriendOutfitCacheOptions<T> = {}): FriendOutfitCache<T> {
  const ttl = opts.ttlMs ?? 60_000;
  const minRefresh = opts.minRefreshMs ?? 5_000;
  const retry = opts.retryUnavailableMs ?? 2 * 60_000;
  const delay = opts.batchDelayMs ?? 30;
  const maxBatch = Math.max(1, Math.min(FRIEND_RPC_MAX_IDS, opts.maxBatch ?? FRIEND_RPC_MAX_IDS));
  const maxPending = opts.maxPendingMs ?? 4_000;
  const maxStoredAge = opts.maxStoredAgeMs ?? 30 * 24 * 60 * 60_000;
  const prefix = opts.storagePrefix ?? FRIEND_OUTFIT_STORAGE_PREFIX;
  const storage = opts.storage;
  const revive = opts.revive ?? ((raw: unknown) => raw as T);
  const now = opts.now ?? Date.now;
  const schedule = opts.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));

  const entries = new Map<string, Entry<T>>();
  const queued = new Set<string>();
  const inflight = new Set<string>();
  /** First time an id was asked for while unknown (drives the placeholder timeout). */
  const askedAt = new Map<string, number>();
  /** Hydrated from storage but not re-fetched in this session yet: always revalidated on the next request. */
  const unverified = new Set<string>();
  const listeners = new Set<() => void>();
  let unavailableUntil = 0;
  let scheduled = false;
  let ver = 0;
  /** undefined = not told yet (session still loading). */
  let owner: string | null | undefined;
  let hydrated = false;
  /** Bumped on every owner change: late fetch/hydrate results of a previous owner are dropped. */
  let epoch = 0;
  let persistScheduled = false;
  let writes: Promise<unknown> = Promise.resolve();
  /** Last friend list given to prune(); also applied to entries that hydrate later. */
  let lastKeep: Set<string> | undefined;
  const ownerMarker = prefix + 'owner';

  const notify = () => { ver++; for (const l of Array.from(listeners)) l(); };
  const norm = (raw: unknown) => typeof raw === 'string' && UUID_RE.test(raw) ? raw.toLowerCase() : null;
  const age = (id: string) => { const e = entries.get(id); return e && !unverified.has(id) ? now() - e.at : Infinity; };
  const keyOf = (o: string) => prefix + o;
  const chain = (job: () => Promise<unknown>) => { writes = writes.then(job).catch(() => undefined); return writes; };

  function schedulePersist() {
    if (!storage || !owner || !hydrated || persistScheduled) return;
    persistScheduled = true;
    schedule(() => {
      persistScheduled = false;
      if (!owner || !hydrated) return;
      const key = keyOf(owner);
      const data: Stored = { v: 1, entries: {} };
      for (const [id, e] of entries) data.entries[id] = { o: e.value, at: e.at };
      const json = JSON.stringify(data);
      void chain(() => storage.setItem(key, json));
    }, 0);
  }

  function armPendingTimeout(id: string) {
    if (askedAt.has(id)) return;
    askedAt.set(id, now());
    // Re-render once the placeholder budget is used up, so a slow network falls back to the classic art.
    schedule(() => { if (!entries.has(id)) notify(); }, maxPending + 1);
  }

  async function flush(): Promise<void> {
    scheduled = false;
    if (now() < unavailableUntil) { queued.clear(); return; }
    const ids = [...queued].filter(id => !inflight.has(id));
    queued.clear();
    if (!ids.length) return;
    const myEpoch = epoch;
    ids.forEach(id => inflight.add(id));
    let changed = false;
    let fetched = false;
    try {
      for (let i = 0; i < ids.length; i += maxBatch) {
        const chunk = ids.slice(i, i + maxBatch);
        let rows: Map<string, T> | undefined;
        try { rows = await fetcher(chunk); } catch { rows = undefined; }
        if (myEpoch !== epoch) return;
        if (!rows) {
          unavailableUntil = now() + retry;
          // Unknown ids stop waiting: 'pending' -> 'none' (classic art), cached outfits stay.
          if (chunk.some(id => !entries.has(id))) changed = true;
          break;
        }
        fetched = true;
        const at = now();
        for (const id of chunk) {
          const value = rows.get(id) ?? null;
          const prev = entries.get(id);
          if (!prev || JSON.stringify(prev.value) !== JSON.stringify(value)) changed = true;
          entries.set(id, { value, at });
          unverified.delete(id);
        }
      }
    } finally {
      if (myEpoch === epoch) ids.forEach(id => inflight.delete(id));
    }
    if (fetched) schedulePersist();
    if (changed) notify();
  }

  function enqueue(ids: readonly string[], maxAge: number) {
    if (now() < unavailableUntil) return;
    for (const raw of ids) {
      const id = norm(raw);
      if (!id) continue;
      if (!entries.has(id)) armPendingTimeout(id);
      if (!inflight.has(id) && age(id) >= maxAge) queued.add(id);
    }
    if (!queued.size || scheduled) return;
    scheduled = true;
    schedule(() => { void flush(); }, delay);
  }

  async function hydrate(target: string, myEpoch: number) {
    let raw: string | null = null;
    try { raw = storage ? await storage.getItem(keyOf(target)) : null; } catch { raw = null; }
    if (myEpoch !== epoch) return;
    if (raw) {
      try {
        const data = JSON.parse(raw) as Stored;
        if (data && data.v === 1 && data.entries && typeof data.entries === 'object') {
          for (const [rawId, e] of Object.entries(data.entries)) {
            const id = norm(rawId);
            if (!id || !e || typeof e.at !== 'number' || now() - e.at > maxStoredAge) continue;
            if (lastKeep && !lastKeep.has(id)) continue;
            const current = entries.get(id);
            if (current && current.at >= e.at) continue; // a fetch already returned something newer
            let value: T | null = null;
            if (e.o != null) { try { value = revive(e.o); } catch { continue; } if (value == null) continue; }
            entries.set(id, { value, at: e.at });
            unverified.add(id);
          }
        }
      } catch { /* corrupt blob: ignore, it is rewritten after the next fetch */ }
    }
    hydrated = true;
    schedulePersist();
    notify();
  }

  const api: FriendOutfitCache<T> = {
    get: id => { const k = norm(id); return k ? entries.get(k)?.value : undefined; },
    status: rawId => {
      const id = norm(rawId);
      if (!id) return 'none';
      const e = entries.get(id);
      if (e) return e.value ? 'outfit' : 'none';
      if (now() < unavailableUntil) return 'none';
      const since = askedAt.get(id);
      if (since !== undefined && now() - since > maxPending) return 'none';
      return 'pending';
    },
    request: ids => enqueue(ids, ttl),
    refresh: ids => enqueue(ids, minRefresh),
    flush,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    version: () => ver,
    isUnavailable: () => now() < unavailableUntil,
    owner: () => owner,
    isHydrated: () => hydrated,
    setOwner: next => {
      if (next === owner) return writes.then(() => undefined);
      const previous = owner;
      owner = next;
      epoch++;
      const myEpoch = epoch;
      // First owner after start: memory was filled with this session's results -> keep and merge.
      if (previous !== undefined) {
        entries.clear(); queued.clear(); inflight.clear(); askedAt.clear(); unverified.clear(); unavailableUntil = 0; lastKeep = undefined;
      }
      if (storage) {
        // The marker remembers whose blob is on the device, so a logout that happened while the app was killed
        // (or a different account signing in) still removes the previous owner's data on the next start.
        void chain(async () => {
          const last = await storage.getItem(ownerMarker);
          for (const stale of new Set([last, previous])) if (stale && stale !== next) await storage.removeItem(keyOf(stale));
          if (next) await storage.setItem(ownerMarker, next); else await storage.removeItem(ownerMarker);
        });
      }
      hydrated = false;
      if (!next) { hydrated = true; notify(); return writes.then(() => undefined); }
      notify();
      return hydrate(next, myEpoch).then(() => writes).then(() => undefined);
    },
    prune: keepIds => {
      const keep = new Set(keepIds.map(norm).filter((id): id is string => !!id));
      lastKeep = keep;
      let changed = false;
      for (const id of [...entries.keys()]) if (!keep.has(id)) { entries.delete(id); askedAt.delete(id); unverified.delete(id); changed = true; }
      if (!changed) return;
      schedulePersist();
      notify();
    },
    idle: () => writes.then(() => undefined),
    clear: () => { entries.clear(); queued.clear(); askedAt.clear(); unverified.clear(); unavailableUntil = 0; notify(); },
  };
  return api;
}

/** Server limit of sx_friend_avatar_outfits(uuid[]): more ids raise an error (22023) instead of returning rows. */
export const FRIEND_RPC_MAX_IDS = 200;

/**
 * Calls `fetchChunk` with at most FRIEND_RPC_MAX_IDS ids per call and merges the rows. If ANY chunk is unavailable
 * (error, e.g. the >200 guard, missing RPC, offline) the whole result is undefined, so the cache backs off and
 * never records "no outfit" for ids whose rows were simply not fetched.
 */
export async function fetchInChunks<T>(ids: readonly string[], fetchChunk: (chunk: string[]) => Promise<Map<string, T> | undefined>, size = FRIEND_RPC_MAX_IDS): Promise<Map<string, T> | undefined> {
  const step = Math.max(1, Math.min(FRIEND_RPC_MAX_IDS, size));
  const out = new Map<string, T>();
  for (let i = 0; i < ids.length; i += step) {
    const rows = await fetchChunk(ids.slice(i, i + step));
    if (!rows) return undefined;
    for (const [id, value] of rows) out.set(id, value);
  }
  return out;
}

/**
 * Parses the sx_friend_avatar_outfits RPC result. `error` -> undefined (unavailable);
 * malformed rows are skipped; each outfit goes through `parse` (parseOutfit validation).
 */
export function parseFriendRows<T>(data: unknown, error: { message: string } | null, parse: (outfit: unknown) => T): Map<string, T> | undefined {
  if (error) return undefined;
  const out = new Map<string, T>();
  if (!Array.isArray(data)) return out;
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const { user_id: id, outfit } = row as { user_id?: unknown; outfit?: unknown };
    if (typeof id !== 'string' || !outfit || typeof outfit !== 'object') continue;
    out.set(id.toLowerCase(), parse(outfit));
  }
  return out;
}

/**
 * Light polling/refresh driver (pure). Runs `run()` every `intervalMs` while the screen is focused AND the app is
 * in the foreground; gaining focus or returning to the foreground runs it immediately. Nothing runs in the
 * background (the interval is cleared, not just skipped).
 */
export type RefreshLoop = { setFocused: (focused: boolean) => void; setForeground: (foreground: boolean) => void; stop: () => void; isRunning: () => boolean };

export function createRefreshLoop(run: () => void, opts: { intervalMs?: number; foreground?: boolean } = {}): RefreshLoop {
  const interval = opts.intervalMs ?? 60_000;
  let focused = false;
  let foreground = opts.foreground ?? true;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stopTimer = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
  const update = (kick: boolean) => {
    const active = focused && foreground;
    if (!active) { stopTimer(); return; }
    if (kick) run();
    if (timer === undefined || kick) { stopTimer(); timer = setInterval(run, interval); }
  };
  return {
    setFocused: next => { const kick = next && !focused; focused = next; update(kick); },
    setForeground: next => { const kick = next && !foreground; foreground = next; update(kick && focused); },
    stop: () => { focused = false; stopTimer(); },
    isRunning: () => timer !== undefined,
  };
}
