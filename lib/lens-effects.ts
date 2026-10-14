/** Which lenses react to expressions and which are world (face-free) effects. Type-only imports. */
import type { PhotoFilterId } from './photo-filters';
import type { Trigger } from './face-filters/expressions';
import type { WorldKind } from './face-filters/worldEffects';

export const LENS_TRIGGERS: Partial<Record<PhotoFilterId, Trigger>> = {
  dragon: 'mouthOpen',
  rainbow: 'mouthOpen',
  blush: 'smile',
  sparkle: 'blink',
};

export const WORLD_LENSES: Partial<Record<PhotoFilterId, WorldKind>> = {
  confetti: 'confetti',
  snow: 'snow',
  heartRain: 'hearts',
};

export const lensTrigger = (id: PhotoFilterId): Trigger | undefined => LENS_TRIGGERS[id];
export const worldKind = (id: PhotoFilterId): WorldKind | undefined => WORLD_LENSES[id];
export const isWorldLens = (id: PhotoFilterId) => worldKind(id) !== undefined;
