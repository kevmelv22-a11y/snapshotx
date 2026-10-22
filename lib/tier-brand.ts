/** Tier branding (Kevin's tier-logos, Oct 2026): display labels + PNG aspect ratios (width/height) for wordmarks and icons.
 *  Internal tier IDs stay 'plus' | 'lens' | 'platinum' | 'family'. Storage-only has no logo. */
import type { Tier } from './plus';
export type BrandTier = Exclude<Tier, 'storage'>;
export const BRAND_TIERS: readonly BrandTier[] = ['plus', 'lens', 'platinum', 'family'];
export const TIER_BRAND: Record<BrandTier, { label: string; short: string; wordmark: [number, number]; icon: [number, number] }> = {
  plus: { label: 'Snapshot X+', short: 'X+', wordmark: [650, 160], icon: [151, 192] },
  lens: { label: 'Snapshot X Lens', short: 'X Lens', wordmark: [954, 160], icon: [195, 192] },
  platinum: { label: 'Snapshot Platinum', short: 'Platinum', wordmark: [1167, 160], icon: [134, 192] },
  family: { label: 'Snapshot Family', short: 'Family', wordmark: [1011, 160], icon: [267, 192] },
};
export const isBrandTier = (t: Tier | null | undefined): t is BrandTier => !!t && t !== 'storage';
/** Width for a given height, keeping the PNG's aspect. */
export const brandWidth = (t: BrandTier, kind: 'wordmark' | 'icon', height: number) => { const [w, h] = TIER_BRAND[t][kind]; return Math.round(height * w / h); };
