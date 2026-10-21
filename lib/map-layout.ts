/**
 * Layout helper for the web map fallback (components/FriendMap.web.tsx). The map screen floats its header
 * (avatar/search/title row, chips, location notice) and footer (actions, hint, friend dock) over the map. On
 * native that is fine (the map is behind it), but the web fallback is a plain list, which then started under
 * the header: "Kaart op je telefoon" and its explanation were hidden behind the floating controls.
 * The screen measures both overlays and the list is padded to sit between them.
 */
export type OverlayInsets = {top: number; bottom: number};

/** Minimum padding of the list (also used before the overlays are measured / when there are none). */
export const WEB_MAP_MIN_PADDING = 22;
/** Breathing room between an overlay and the list. */
export const WEB_MAP_OVERLAY_GAP = 12;

const clean = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

export function webMapListPadding(insets?: OverlayInsets | null): {paddingTop: number; paddingBottom: number} {
  const top = clean(insets?.top), bottom = clean(insets?.bottom);
  return {
    paddingTop: top ? Math.max(WEB_MAP_MIN_PADDING, Math.ceil(top + WEB_MAP_OVERLAY_GAP)) : WEB_MAP_MIN_PADDING,
    paddingBottom: bottom ? Math.max(WEB_MAP_MIN_PADDING, Math.ceil(bottom + WEB_MAP_OVERLAY_GAP)) : WEB_MAP_MIN_PADDING,
  };
}
