/**
 * kind: 'tint' = colour grade over the whole snap; 'face' = lens drawn on detected face landmarks;
 * 'frame' = decoration placed around the face (or centred when no face is found).
 */
export const PHOTO_FILTERS = [
  {id: 'original', name: 'Origineel', tint: 'transparent', category: 'all', kind: 'tint', keywords: 'geen normaal'},
  {id: 'warm', name: 'Warm', tint: '#FF9A0030', category: 'mood', kind: 'tint', keywords: 'zomer oranje zon'},
  {id: 'cool', name: 'Koel', tint: '#297BFF30', category: 'mood', kind: 'tint', keywords: 'blauw koud winter'},
  {id: 'pink', name: 'Roze', tint: '#FF319C28', category: 'color', kind: 'tint', keywords: 'pink kleur'},
  {id: 'gold', name: 'Goud', tint: '#FFC70030', category: 'color', kind: 'tint', keywords: 'geel golden hour'},
  {id: 'mint', name: 'Munt', tint: '#17CFA12C', category: 'color', kind: 'tint', keywords: 'groen fris'},
  {id: 'night', name: 'Nacht', tint: '#07103460', category: 'mood', kind: 'tint', keywords: 'donker avond'},
  {id: 'vintage', name: 'Vintage', tint: '#965D2D48', category: 'creative', kind: 'tint', keywords: 'retro oud film'},
  {id: 'dog', name: 'Hond', tint: 'transparent', category: 'animals', kind: 'face', keywords: 'puppy dier oren'},
  {id: 'cat', name: 'Kat', tint: 'transparent', category: 'animals', kind: 'face', keywords: 'poes dier snorharen'},
  {id: 'rabbit', name: 'Konijn', tint: 'transparent', category: 'animals', kind: 'face', keywords: 'haas dier oren'},
  {id: 'balaclava', name: 'Balaclava', tint: 'transparent', category: 'masks', kind: 'face', keywords: 'bivakmuts masker muts zwart'},
  {id: 'sunglasses', name: 'Zonnebril', tint: 'transparent', category: 'masks', kind: 'face', keywords: 'bril cool'},
  {id: 'crown', name: 'Kroon', tint: 'transparent', category: 'masks', kind: 'face', keywords: 'koning koningin'},
  {id: 'hearts', name: 'Hartjes', tint: 'transparent', category: 'creative', kind: 'frame', keywords: 'liefde love'},
] as const;

export type PhotoFilter = (typeof PHOTO_FILTERS)[number];
export type PhotoFilterId = PhotoFilter['id'];
export type PhotoFilterCategory = 'all' | 'recent' | 'favorites' | 'animals' | 'masks' | 'mood' | 'color' | 'creative';

export const isPhotoFilterId = (id: unknown): id is PhotoFilterId => PHOTO_FILTERS.some((f) => f.id === id);
export const photoFilter = (id: PhotoFilterId): PhotoFilter => PHOTO_FILTERS.find((f) => f.id === id) ?? PHOTO_FILTERS[0];
/** Lenses that are drawn on face landmarks and need a detected face. */
export const isFaceLens = (id: PhotoFilterId) => photoFilter(id).kind === 'face';
export const hasPhotoOverlay = (id: PhotoFilterId) => photoFilter(id).kind !== 'tint';

export function photoFilterIndex(id?: PhotoFilterId) {
  return Math.max(0, PHOTO_FILTERS.findIndex((filter) => filter.id === id));
}
