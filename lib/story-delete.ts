/** Own-story delete: soft-delete by expiring + marking removed_at (same pattern as staff). */
export const STORY_DELETE_TEXT = {
  action: 'Verhaal verwijderen',
  title: 'Dit verhaal verwijderen?',
  message: 'Vrienden kunnen dit verhaal dan niet meer bekijken. Dit kan niet ongedaan worden gemaakt.',
  confirm: 'Verwijderen',
  done: 'Verhaal verwijderd',
} as const;

/** Patch written when the owner deletes their own story (RLS update allows owner). */
export function storyDeletePatch(now = new Date()): { removed_at: string; expires_at: string } {
  const iso = now.toISOString();
  return { removed_at: iso, expires_at: iso };
}

/** Active story feeds must hide soft-deleted rows even if expires_at is still in the future. */
export function isStoryActive(row: { expires_at?: string | null; removed_at?: string | null }, now = Date.now()): boolean {
  if (row.removed_at) return false;
  if (!row.expires_at) return false;
  return Date.parse(row.expires_at) > now;
}
