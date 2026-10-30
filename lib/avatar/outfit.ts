/**
 * Pure outfit logic for the avatarkast (wardrobe) screen.
 * No runtime imports, so it runs under `node --test` (type stripping) as well as in Metro.
 */

export type WardrobeCategory = 'top' | 'bottom' | 'dress' | 'shoes' | 'socks' | 'bag' | 'outerwear' | 'hat' | 'accessory' | 'glasses';
export type Layer = WardrobeCategory | 'hair' | 'skin' | 'eyes';
export type HairStyle = 'curly' | 'short' | 'wavy' | 'buzz' | 'long' | 'afro' | 'bun' | 'curtain' | 'curtain-short' | 'kuif' | 'twists' | 'hanenkam' | 'manbun' | 'stekels' | 'zijscheiding';
export const HAIR_STYLES: HairStyle[] = ['curly', 'short', 'wavy', 'buzz', 'long', 'afro', 'bun', 'curtain', 'curtain-short', 'kuif', 'twists', 'hanenkam', 'manbun', 'stekels', 'zijscheiding'];
export type CategoryTab = 'featured' | 'all' | WardrobeCategory;
export type Pattern = 'plain' | 'plaid' | 'stripes' | 'roses' | 'camo' | 'baroque' | 'quilt' | 'hearts' | 'wrap' | 'swirl' | 'patches';

export type ItemPreview = {
  /** Shape variant understood by components/avatar/AvatarArt. */
  variant: string;
  pattern?: Pattern;
  /** Optional chest graphic / detail. */
  graphic?: 'wave' | 'skull' | 'pumpkin' | 'heart' | 'patch' | 'stripes2' | 'star';
};

export type WardrobeItem = {
  id: string;
  category: WardrobeCategory;
  brand: string;
  name: string;
  /** null = free. */
  priceCents: number | null;
  /** [primary, secondary, accent]; primary is recolourable per layer. */
  colors: string[];
  preview: ItemPreview;
  featured?: boolean;
  /** Staff-only item: only users with one of these staff roles see/wear it (lib/avatar/staffWardrobe). */
  staffRoles?: readonly ('MODERATOR' | 'SENIOR MODERATOR' | 'ADMIN' | 'OWNER')[];
};

export type Outfit = {
  top: string | null;
  bottom: string | null;
  dress: string | null;
  shoes: string | null;
  socks: string | null;
  bag: string | null;
  outerwear: string | null;
  hat: string | null;
  accessory: string | null;
  glasses: string | null;
  /** Avatar body: hair style variant (colours for hair/skin live in `colors`). */
  hairStyle: HairStyle;
  /** Primary colour override per layer (hair and skin included). */
  colors: Partial<Record<Layer, string>>;
  /** Character set chosen at registration (absent = 'male'): picks the male or female pre-rendered art. */
  gender?: Gender;
  /** Most recently picked item (Kast tap): its worn image is shown while that item is still on (lib/avatar/worn). */
  worn?: string;
  /** Last picked torso item (top / outerwear / dress): the composite doll shows it as the visible upper body. */
  torso?: string;
};

export type Gender = 'male' | 'female';
export const GENDERS: Gender[] = ['male', 'female'];
export const isGender = (v: unknown): v is Gender => v === 'male' || v === 'female';

export const CATEGORIES: WardrobeCategory[] = ['top', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'outerwear', 'hat', 'accessory', 'glasses'];

export const DEFAULT_HAIR = '#8A5A2B';
export const DEFAULT_SKIN = '#DD9A72';

export const DEFAULT_OUTFIT: Outfit = {
  top: 'top-blueberry-white-tee',
  bottom: 'bottom-white-cargo',
  dress: null,
  shoes: 'shoes-nike-white',
  socks: null,
  bag: null,
  outerwear: 'outer-nike-swoosh-hoodie',
  hat: null,
  accessory: null,
  glasses: null,
  hairStyle: 'curly',
  colors: {},
};

/** Female start look (reference art): black cap, black tee, grey jeans, white sneakers, blonde wavy hair. */
export const DEFAULT_FEMALE_OUTFIT: Outfit = {
  top: 'top-nike-black-tee',
  bottom: 'bottom-basisbes-grey-jeans',
  dress: null,
  shoes: 'shoes-nike-white',
  socks: null,
  bag: null,
  outerwear: null,
  hat: 'hat-nike-cap',
  accessory: null,
  glasses: null,
  hairStyle: 'wavy',
  colors: { hair: '#D2A85E' },
  gender: 'female',
};

/** Start outfit for a character set (male = hoodie DEFAULT_OUTFIT, female = cap + black tee). */
export function defaultOutfitFor(gender: Gender | null | undefined): Outfit {
  return gender === 'female' ? { ...DEFAULT_FEMALE_OUTFIT, colors: { ...DEFAULT_FEMALE_OUTFIT.colors } } : { ...DEFAULT_OUTFIT, colors: {} };
}

export function isFree(item: Pick<WardrobeItem, 'priceCents'>): boolean {
  return item.priceCents == null || item.priceCents <= 0;
}

export function isOwned(item: Pick<WardrobeItem, 'id' | 'priceCents'>, unlocked: readonly string[]): boolean {
  return isFree(item) || unlocked.includes(item.id);
}

/** nl-NL euro formatting, e.g. 200 -> "€ 2,00", 29 -> "€ 0,29". */
export function formatPriceCents(cents: number): string {
  const euros = Math.floor(Math.abs(cents) / 100);
  const rest = String(Math.abs(cents) % 100).padStart(2, '0');
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}€ ${grouped},${rest}`;
}

/** Wear an item: replaces its layer and resets that layer's colour override. Dress and top/bottom are mutually exclusive. */
export function wearItem(outfit: Outfit, item: Pick<WardrobeItem, 'id' | 'category'>): Outfit {
  const colors = { ...outfit.colors };
  delete colors[item.category];
  const next: Outfit = { ...outfit, colors, [item.category]: item.id, worn: item.id };
  if (item.category === 'top' || item.category === 'outerwear' || item.category === 'dress') next.torso = item.id;
  if (item.category === 'top' || item.category === 'bottom') next.dress = null;
  return next;
}

export function removeLayer(outfit: Outfit, layer: WardrobeCategory): Outfit {
  const colors = { ...outfit.colors };
  delete colors[layer];
  const next: Outfit = { ...outfit, colors, [layer]: null };
  if (next.worn && next.worn === outfit[layer]) delete next.worn;
  if (next.torso && next.torso === outfit[layer]) delete next.torso;
  return next;
}

export function recolor(outfit: Outfit, layer: Layer, color: string): Outfit {
  return { ...outfit, colors: { ...outfit.colors, [layer]: color } };
}

export function sameOutfit(a: Outfit, b: Outfit): boolean {
  if (CATEGORIES.some(c => a[c] !== b[c]) || a.hairStyle !== b.hairStyle || (a.gender ?? 'male') !== (b.gender ?? 'male') || a.worn !== b.worn || a.torso !== b.torso) return false;
  const keys = new Set([...Object.keys(a.colors), ...Object.keys(b.colors)]) as Set<Layer>;
  for (const k of keys) if (a.colors[k] !== b.colors[k]) return false;
  return true;
}

// ---------------------------------------------------------------- undo / redo history
export type OutfitHistory = { past: Outfit[]; present: Outfit; future: Outfit[] };
export const HISTORY_LIMIT = 40;

export function startHistory(present: Outfit): OutfitHistory { return { past: [], present, future: [] }; }

export function pushHistory(h: OutfitHistory, next: Outfit): OutfitHistory {
  if (sameOutfit(h.present, next)) return h;
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

export function undoHistory(h: OutfitHistory): OutfitHistory {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redoHistory(h: OutfitHistory): OutfitHistory {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

// ---------------------------------------------------------------- persistence helpers
const HEX_RE = /^#[0-9a-f]{6}$/i;
const LAYERS: Layer[] = [...CATEGORIES, 'hair', 'skin', 'eyes'];

/** Validates a stored outfit; unknown ids / categories fall back to the default outfit. */
export function parseOutfit(value: unknown, items: readonly Pick<WardrobeItem, 'id' | 'category'>[]): Outfit {
  const src = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  if (!src) return { ...DEFAULT_OUTFIT, colors: {} };
  const byId = new Map(items.map(i => [i.id, i]));
  const out: Outfit = { ...DEFAULT_OUTFIT, colors: {} };
  for (const c of CATEGORIES) {
    const v = src[c];
    if (v === null) out[c] = null;
    else if (typeof v === 'string' && byId.get(v)?.category === c) out[c] = v;
  }
  if (typeof src.hairStyle === 'string' && (HAIR_STYLES as string[]).includes(src.hairStyle)) out.hairStyle = src.hairStyle as HairStyle;
  if (src.gender === 'female') out.gender = 'female';
  if (typeof src.worn === 'string' && CATEGORIES.some(c => out[c] === src.worn)) out.worn = src.worn;
  if (typeof src.torso === 'string' && CATEGORIES.some(c => out[c] === src.torso)) out.torso = src.torso;
  const colors = src.colors && typeof src.colors === 'object' ? src.colors as Record<string, unknown> : {};
  for (const l of LAYERS) { const v = colors[l]; if (typeof v === 'string' && HEX_RE.test(v)) out.colors[l] = v; }
  return out;
}

/** Item ids in the outfit that are paid and not unlocked (would be dropped on save). */
export function unownedItems<T extends WardrobeItem>(outfit: Outfit, items: readonly T[], unlocked: readonly string[]): T[] {
  const byId = new Map(items.map(i => [i.id, i]));
  return CATEGORIES.map(c => outfit[c] ? byId.get(outfit[c]!) : undefined).filter((i): i is T => !!i && !isOwned(i, unlocked));
}

/** Replaces items that are not owned with the fallback outfit's value (or nothing). Used before saving. */
export function sanitizeOutfit(outfit: Outfit, items: readonly WardrobeItem[], unlocked: readonly string[], fallback: Outfit): Outfit {
  const byId = new Map(items.map(i => [i.id, i]));
  const out: Outfit = { ...outfit, colors: { ...outfit.colors } };
  for (const c of CATEGORIES) {
    const id = out[c];
    if (!id) continue;
    const item = byId.get(id);
    if (item && isOwned(item, unlocked)) continue;
    const fb = fallback[c];
    const fbItem = fb ? byId.get(fb) : undefined;
    if (out.worn === id) delete out.worn;
    if (out.torso === id) delete out.torso;
    out[c] = fbItem && isOwned(fbItem, unlocked) ? fb : null;
    delete out.colors[c];
  }
  return out;
}

/** Apply a complete look: every clothing layer comes from the look (missing layers are cleared); body (hair/skin) is kept. */
export function applyLook(outfit: Outfit, look: Partial<Record<WardrobeCategory, string | null>>): Outfit {
  const colors: Outfit['colors'] = {};
  if (outfit.colors.hair) colors.hair = outfit.colors.hair;
  if (outfit.colors.skin) colors.skin = outfit.colors.skin;
  const next: Outfit = { ...outfit, colors };
  delete next.worn; delete next.torso; // a look is shown as a whole (look art), not as the last single item
  for (const c of CATEGORIES) next[c] = look[c] ?? null;
  return next;
}

// ---------------------------------------------------------------- account sync (pure part)
export type SyncSnapshot = { outfit: Outfit; unlocked: string[]; updatedAt: string | null };

function time(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Reconciles the device copy with the account copy: the newest `updatedAt` wins for the outfit;
 * unlocked ids are merged (an unlock is never lost). `push` = the remote copy must be updated.
 */
export function reconcile(local: SyncSnapshot, remote: SyncSnapshot | null): SyncSnapshot & { push: boolean; source: 'local' | 'remote' } {
  if (!remote) return { ...local, push: local.updatedAt != null || local.unlocked.length > 0, source: 'local' };
  const unlocked = [...new Set([...local.unlocked, ...remote.unlocked])];
  const remoteNewer = time(remote.updatedAt) > time(local.updatedAt);
  const winner = remoteNewer ? remote : local;
  const unlockedChanged = unlocked.length !== remote.unlocked.length;
  const outfitChanged = !remoteNewer && (time(local.updatedAt) > time(remote.updatedAt) || !sameOutfit(local.outfit, remote.outfit));
  return { outfit: winner.outfit, unlocked, updatedAt: winner.updatedAt, push: unlockedChanged || (outfitChanged && local.updatedAt != null), source: remoteNewer ? 'remote' : 'local' };
}

// ---------------------------------------------------------------- grid helpers
export type SortMode = 'default' | 'price' | 'name';

export function itemsForTab<T extends WardrobeItem>(items: readonly T[], tab: CategoryTab, opts: { onlyFree?: boolean; sort?: SortMode } = {}): T[] {
  let list = items.filter(i => tab === 'all' ? true : tab === 'featured' ? !!i.featured : i.category === tab);
  if (opts.onlyFree) list = list.filter(isFree);
  if (opts.sort === 'price') list = [...list].sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0) || a.name.localeCompare(b.name, 'nl'));
  else if (opts.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  return list;
}
