/**
 * Demo-only friend portraits (assets/avatar-art/friend-*.png, cropped from a 2x2 art grid). Only the seeded
 * web-demo friends (EXPO_PUBLIC_DEMO_MODE=1) get one; everyone else keeps their outfit / classic avatar.
 */
export type FriendArtKey = 'friend-blonde' | 'friend-brown' | 'friend-cap' | 'friend-black';
export const DEMO_FRIEND_ART: Record<string, FriendArtKey> = {
  '0b000000-0000-4000-8000-000000000011': 'friend-blonde', // aria
  '0b000000-0000-4000-8000-000000000015': 'friend-brown', // eva
  '0b000000-0000-4000-8000-000000000013': 'friend-cap', // cleo
  '0b000000-0000-4000-8000-000000000016': 'friend-black', // noor
};
export function friendArtFor(id: string | null | undefined): FriendArtKey | null {
  if (process.env.EXPO_PUBLIC_DEMO_MODE !== '1' || !id) return null;
  return DEMO_FRIEND_ART[id] ?? null;
}
