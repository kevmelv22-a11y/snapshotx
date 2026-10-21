/** Pure logic for the snap editor (drawing, stickers, text, timer). No React / RN imports so it is unit-testable. */

export type Point = { x: number; y: number };
export type Stroke = { color: string; width: number; points: Point[] };

export const BRUSH_COLORS = ['#FFFFFF', '#000000', '#FFE436', '#FF5B95', '#FF3B30', '#FF9500', '#34C759', '#4298FF', '#AE16C7'] as const;
export const BRUSH_SIZES = [4, 8, 14, 22] as const;
export const MAX_STROKES = 200;

/** Starts a new stroke; keeps at most MAX_STROKES (oldest dropped). */
export function startStroke(strokes: Stroke[], p: Point, color: string, width: number): Stroke[] {
  const next = [...strokes, { color, width, points: [p] }];
  return next.length > MAX_STROKES ? next.slice(next.length - MAX_STROKES) : next;
}

/** Appends a point to the last stroke, ignoring jitter closer than `minDist` px. */
export function extendStroke(strokes: Stroke[], p: Point, minDist = 1.5): Stroke[] {
  if (!strokes.length) return strokes;
  const last = strokes[strokes.length - 1];
  const prev = last.points[last.points.length - 1];
  if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < minDist) return strokes;
  return [...strokes.slice(0, -1), { ...last, points: [...last.points, p] }];
}

/** Removes the most recent stroke (one undo step). */
export const undoStroke = (strokes: Stroke[]): Stroke[] => strokes.slice(0, -1);

/** SVG path data. A single point becomes a tiny segment so a tap still leaves a dot (round cap). */
export function strokeToPath(points: Point[]): string {
  if (!points.length) return '';
  const r = (n: number) => Math.round(n * 10) / 10;
  const [first, ...rest] = points;
  const tail = rest.length ? rest : [{ x: first.x + 0.1, y: first.y }];
  return `M ${r(first.x)} ${r(first.y)}` + tail.map((q) => ` L ${r(q.x)} ${r(q.y)}`).join('');
}

// ---------- Stickers ----------

export type Sticker = { id: string; emoji: string; x: number; y: number; scale: number; rotation: number };
export const STICKER_EMOJI = ['😂', '😍', '🔥', '❤️', '⭐', '😎', '👍', '🎉', '😭', '🥳', '💯', '👀', '🙈', '🌈', '☀️', '🍕', '⚽', '🐶', '🐱', '🦁', '👑', '💀', '✨', '🤯'] as const;
export const STICKER_BASE_SIZE = 90;
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 5;

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number.isFinite(s) ? s : 1));
/** Normalises radians into (-π, π]. */
export function normalizeAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

export function addSticker(list: Sticker[], emoji: string, id: string, center: Point): Sticker[] {
  return [...list, { id, emoji, x: center.x, y: center.y, scale: 1, rotation: 0 }];
}
export const removeSticker = (list: Sticker[], id: string) => list.filter((s) => s.id !== id);
export const updateSticker = (list: Sticker[], id: string, patch: Partial<Omit<Sticker, 'id'>>) =>
  list.map((s) => (s.id === id ? { ...s, ...patch } : s));
/** Moves a sticker to the top of the z-order. */
export function bringToFront(list: Sticker[], id: string): Sticker[] {
  const s = list.find((x) => x.id === id);
  return s ? [...list.filter((x) => x.id !== id), s] : list;
}

/** Two-finger snapshot: distance, angle and midpoint between touches. */
export type Pinch = { dist: number; angle: number; mid: Point };
export function pinchOf(a: Point, b: Point): Pinch {
  return { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}

/** Applies a gesture relative to its start (start transform + start pinch) and returns the new transform. */
export function applyGesture(
  start: { x: number; y: number; scale: number; rotation: number },
  from: Pinch | Point,
  to: Pinch | Point,
): { x: number; y: number; scale: number; rotation: number } {
  if ('dist' in from && 'dist' in to) {
    const ratio = from.dist > 0 ? to.dist / from.dist : 1;
    return {
      x: start.x + (to.mid.x - from.mid.x),
      y: start.y + (to.mid.y - from.mid.y),
      scale: clampScale(start.scale * ratio),
      rotation: normalizeAngle(start.rotation + (to.angle - from.angle)),
    };
  }
  const f = 'mid' in from ? from.mid : from;
  const t = 'mid' in to ? to.mid : to;
  return { ...start, x: start.x + (t.x - f.x), y: start.y + (t.y - f.y) };
}

/** Delete zone: a circle of `radius` around the trash icon. */
export const isOverTrash = (p: Point, trash: Point, radius = 44) => Math.hypot(p.x - trash.x, p.y - trash.y) <= radius;

// ---------- Text ----------

export type TextStyleId = 'caption' | 'big' | 'background';
export const TEXT_STYLES: { id: TextStyleId; label: string }[] = [
  { id: 'caption', label: 'Balk' },
  { id: 'big', label: 'Groot' },
  { id: 'background', label: 'Achtergrond' },
];
export type SnapText = { text: string; style: TextStyleId; color: string; y: number; x: number };

export function nextTextStyle(id: TextStyleId): TextStyleId {
  const i = TEXT_STYLES.findIndex((s) => s.id === id);
  return TEXT_STYLES[(i + 1) % TEXT_STYLES.length].id;
}

/** Readable text colour on a coloured background (YIQ). */
export function contrastText(hex: string): '#000000' | '#FFFFFF' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq >= 150 ? '#000000' : '#FFFFFF';
}

export type ResolvedTextStyle = { fontSize: number; color: string; backgroundColor: string; fullWidth: boolean; align: 'center' };
/** Visual properties per style. Caption = full-width translucent bar (colour ignored). */
export function resolveTextStyle(t: Pick<SnapText, 'style' | 'color'>): ResolvedTextStyle {
  switch (t.style) {
    case 'caption': return { fontSize: 18, color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.6)', fullWidth: true, align: 'center' };
    case 'big': return { fontSize: 38, color: t.color, backgroundColor: 'transparent', fullWidth: false, align: 'center' };
    case 'background': return { fontSize: 28, color: contrastText(t.color), backgroundColor: t.color, fullWidth: false, align: 'center' };
  }
}

/** Keeps a vertical position (0..1 of preview height) inside the visible area. */
export const clampUnit = (v: number, min = 0.05, max = 0.9) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0.5));
export const MAX_TEXT_LENGTH = 80;
export const sanitizeText = (s: string) => s.replace(/\s+/g, ' ').trimStart().slice(0, MAX_TEXT_LENGTH);

// ---------- Timer / view-once ----------

/** null = onbeperkt (∞). */
export type ViewSeconds = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | null;
export type SnapTiming = { viewSeconds: ViewSeconds; viewOnce: boolean };
export const TIMER_OPTIONS: ViewSeconds[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null];
export const DEFAULT_TIMING: SnapTiming = { viewSeconds: null, viewOnce: true };

export function normalizeViewSeconds(v: unknown): ViewSeconds {
  if (v === null || v === undefined || v === '∞') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.max(1, n)) as ViewSeconds;
}

export const timerLabel = (v: ViewSeconds) => (v === null ? '∞' : `${v} s`);
export function timingSummary(t: SnapTiming): string {
  const dur = t.viewSeconds === null ? 'Onbeperkt' : `${t.viewSeconds} sec`;
  return `${dur} · ${t.viewOnce ? 'eenmalig bekijken' : 'opnieuw bekijken mag'}`;
}

/** Fields written on the snap message row. */
export function snapMessageFields(t: SnapTiming): { view_once: boolean; view_seconds: number | null } {
  return { view_once: t.viewOnce, view_seconds: normalizeViewSeconds(t.viewSeconds) };
}

/** How long (ms) the receiver may look at an opened snap; null = stays open. Unlimited view-once keeps the legacy 85 s cap. */
export function openDurationMs(viewSeconds: number | null | undefined, viewOnce: boolean, legacyMs = 85000): number | null {
  const v = normalizeViewSeconds(viewSeconds);
  if (v !== null) return v * 1000;
  return viewOnce ? legacyMs : null;
}

/** Overlay summary stored on the snap object (for future server-side rendering / auditing). */
export type SnapEdit = { strokes: Stroke[]; stickers: Sticker[]; text: SnapText | null; timing: SnapTiming };
export const EMPTY_EDIT: SnapEdit = { strokes: [], stickers: [], text: null, timing: DEFAULT_TIMING };
export const hasOverlay = (e: SnapEdit) => e.strokes.length > 0 || e.stickers.length > 0 || !!e.text?.text.trim();
