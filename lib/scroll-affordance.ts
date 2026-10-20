/**
 * Pure helpers for horizontally scrolling rows (components/EdgeScrollRow.tsx): which edges still hide
 * content (so we can show a "more" affordance) and how far to scroll to reveal a given item.
 */
export type ScrollMetrics = { offset: number; viewport: number; content: number };

/** Edges that still hide content. `slack` absorbs sub-pixel rounding (web reports fractional widths). */
export function hiddenEdges({ offset, viewport, content }: ScrollMetrics, slack = 4): { left: boolean; right: boolean } {
  if (!(viewport > 0) || !(content > viewport + slack)) return { left: false, right: false };
  return { left: offset > slack, right: offset + viewport < content - slack };
}

export function clampOffset(offset: number, viewport: number, content: number): number {
  return Math.max(0, Math.min(offset, Math.max(0, content - viewport)));
}

/**
 * Offset that brings [itemX, itemX + itemWidth] fully into view with `margin` room for the edge
 * affordances, or null when it is already visible (avoids needless scroll jumps).
 */
export function revealOffset(itemX: number, itemWidth: number, m: ScrollMetrics, margin = 40): number | null {
  if (!(m.viewport > 0) || !(itemWidth > 0)) return null;
  const left = itemX - margin, right = itemX + itemWidth + margin;
  let next: number | null = null;
  if (left < m.offset) next = left;
  else if (right > m.offset + m.viewport) next = right - m.viewport;
  if (next == null) return null;
  const clamped = clampOffset(next, m.viewport, m.content);
  return Math.abs(clamped - m.offset) < 1 ? null : clamped;
}

/** One "page" step for the edge chevrons: most of the viewport, keeping some context visible. */
export function pageStep(direction: -1 | 1, m: ScrollMetrics): number {
  return clampOffset(m.offset + direction * Math.max(80, m.viewport * 0.6), m.viewport, m.content);
}
