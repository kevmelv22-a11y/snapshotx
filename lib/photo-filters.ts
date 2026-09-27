export const PHOTO_FILTERS = [
  {id: 'original', name: 'Origineel', tint: 'transparent', category: 'all'},
  {id: 'warm', name: 'Warm', tint: '#FF9A0030', category: 'mood'},
  {id: 'cool', name: 'Koel', tint: '#297BFF30', category: 'mood'},
  {id: 'pink', name: 'Roze', tint: '#FF319C28', category: 'color'},
  {id: 'gold', name: 'Goud', tint: '#FFC70030', category: 'color'},
  {id: 'mint', name: 'Munt', tint: '#17CFA12C', category: 'color'},
  {id: 'night', name: 'Nacht', tint: '#07103460', category: 'mood'},
  {id: 'vintage', name: 'Vintage', tint: '#965D2D48', category: 'creative'},
  {id: 'dog', name: 'Hond', tint: 'transparent', category: 'animals'},
  {id: 'cat', name: 'Kat', tint: 'transparent', category: 'animals'},
  {id: 'rabbit', name: 'Konijn', tint: 'transparent', category: 'animals'},
  {id: 'balaclava', name: 'Balaclava', tint: 'transparent', category: 'masks'},
  {id: 'sunglasses', name: 'Zonnebril', tint: 'transparent', category: 'masks'},
  {id: 'crown', name: 'Kroon', tint: 'transparent', category: 'masks'},
  {id: 'hearts', name: 'Hartjes', tint: 'transparent', category: 'creative'},
] as const;

export type PhotoFilterId = (typeof PHOTO_FILTERS)[number]['id'];
export type PhotoFilterCategory = 'all' | 'recent' | 'favorites' | 'animals' | 'masks' | 'mood' | 'color' | 'creative';

export const hasPhotoOverlay = (id: PhotoFilterId) =>
  ['dog', 'cat', 'rabbit', 'balaclava', 'sunglasses', 'crown', 'hearts'].includes(id);

export function photoFilterIndex(id?: PhotoFilterId) {
  return Math.max(0, PHOTO_FILTERS.findIndex((filter) => filter.id === id));
}
