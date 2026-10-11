/** Tiny hex colour helpers for the wardrobe renderer (pure, no imports). */
function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }

export function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Mix two colours; t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a), y = parseHex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** amount > 0 lightens towards white, amount < 0 darkens towards black. */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mix(hex, '#FFFFFF', amount) : mix(hex, '#000000', -amount);
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
