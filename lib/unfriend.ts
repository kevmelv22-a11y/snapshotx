/** Pure helpers for "Vriendschap beëindigen" (friend profile). */
export const UNFRIEND_TEXT = {
  action: 'Vriendschap beëindigen',
  title: (name: string) => `${name} als vriend verwijderen?`,
  message:
    'Jullie zijn dan geen vrienden meer. Jullie chats blijven staan, maar je ziet elkaars verhalen en locatie niet meer. Je kunt elkaar later opnieuw toevoegen.',
  confirm: 'Beëindigen',
  done: 'Vriendschap beëindigd',
} as const;

/** Map RPC / PostgREST errors to a short Dutch line. */
export function unfriendErrorText(err: unknown): string | null {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/not friends/i.test(msg)) return 'Jullie zijn geen vrienden (meer).';
  if (/invalid friend/i.test(msg)) return 'Deze gebruiker kon niet worden verwijderd.';
  if (/sign in required|42501|not authorized/i.test(msg)) return 'Log opnieuw in om door te gaan.';
  return null;
}
