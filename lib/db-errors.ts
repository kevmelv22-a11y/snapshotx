/**
 * Friendly Dutch texts for Supabase/PostgREST/Postgres errors, so screens never show raw messages such as
 * "permission denied for table sx_locations" or "Cannot coerce the result to a single JSON object".
 * Pure (no React Native imports) so it can be unit-tested with `npx tsx --test`.
 *
 * Usage: setNotice(friendlyError(error))                       → "Er ging iets mis…"
 *        setNotice(friendlyError(error, 'Je vrienden'))        → "Je vrienden: nu niet beschikbaar (…)"
 *        if (isUnavailable(error)) { …show the screen without that part… }
 */
export type DbErrorKind =
  | 'permission'        // 42501 "permission denied for table …": the role has no GRANT (server setup)
  | 'rls'               // 42501 "new row violates row-level security policy": not allowed for this row
  | 'missing_table'     // 42P01 / PGRST205: table not created yet
  | 'missing_column'    // 42703 / PGRST204: column (migration) not applied yet
  | 'missing_function'  // 42883 / PGRST202: RPC not created yet
  | 'no_row'            // PGRST116: .single() got 0 (or more than 1) rows
  | 'network'
  | 'auth'              // expired/invalid session
  | 'duplicate'         // 23505
  | 'invalid'           // check/not-null/format violations
  | 'blocked'           // banned / interaction blocked
  | 'unknown';

type ErrorShape = { message?: unknown; code?: unknown; status?: unknown; details?: unknown; hint?: unknown; name?: unknown };

function shape(e: unknown): ErrorShape {
  if (e && typeof e === 'object') return e as ErrorShape;
  if (typeof e === 'string') return { message: e };
  return {};
}
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function dbErrorKind(e: unknown): DbErrorKind {
  const s = shape(e), code = str(s.code), msg = str(s.message), status = Number(s.status);
  if (code === '42501' || /permission denied/i.test(msg)) {
    if (/row-level security/i.test(msg)) return 'rls';
    if (/account_blocked|banned/i.test(msg)) return 'blocked';
    return 'permission';
  }
  if (/row-level security/i.test(msg)) return 'rls';
  if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)) return 'missing_table';
  if (code === '42703' || code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(msg)) return 'missing_column';
  if (code === '42883' || code === 'PGRST202' || /could not find the function|function .* does not exist/i.test(msg)) return 'missing_function';
  if (code === 'PGRST116' || /cannot coerce the result to a single json object|json object requested, multiple \(or no\) rows/i.test(msg)) return 'no_row';
  if (code === 'PGRST301' || code === 'PGRST302' || status === 401 || /jwt|refresh token|not_authenticated|session (has )?expired|auth session missing/i.test(msg)) return 'auth';
  if (/failed to fetch|network request failed|networkerror|load failed|timeout|timed out|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(msg) || s.name === 'AuthRetryableFetchError') return 'network';
  if (code === '23505' || /duplicate key/i.test(msg)) return 'duplicate';
  if (/^(23502|23514|22P02|22023|22001|23503)$/.test(code) || /violates check constraint|invalid input syntax/i.test(msg)) return 'invalid';
  if (/interaction blocked|account_blocked/i.test(msg)) return 'blocked';
  return 'unknown';
}

/** Server side not set up (yet) for this feature: the screen should keep working without it. */
export function isUnavailable(e: unknown): boolean {
  const k = dbErrorKind(e);
  return k === 'permission' || k === 'missing_table' || k === 'missing_column' || k === 'missing_function';
}

/** Known exceptions raised by our own SQL functions and Supabase Auth, in Dutch. */
const KNOWN: [RegExp, string][] = [
  // expo-file-system File/Directory without its native methods (see lib/media-bytes.ts), or our MediaReadError.
  [/validatePath|bestand kon niet worden gelezen|FileSystem|could not read file|isn't readable/i, 'Je foto, video of spraakbericht kon niet worden gelezen. Probeer het opnieuw of kies een ander bestand.'],
  // Server-side name filter (supabase/migrations/20261031030000_server_name_filter.sql).
  [/name_not_allowed:offensive/i, 'Deze naam is niet toegestaan: er staat een grof of kwetsend woord in.'],
  [/name_not_allowed:reserved/i, 'Deze naam lijkt op een officieel Snapshot X-account. Kies een andere naam.'],
  [/friend request not found/i, 'Dit vriendschapsverzoek bestaat niet meer.'],
  [/only friends can be added/i, 'Je kunt alleen vrienden toevoegen aan een chat.'],
  [/choose 1 to 20 friends/i, 'Kies 1 tot 20 vrienden.'],
  [/sign in required/i, 'Log eerst in.'],
  [/not a member/i, 'Je zit niet (meer) in deze chat.'],
  [/invalid login credentials/i, 'E-mailadres of wachtwoord klopt niet.'],
  [/email not confirmed/i, 'Bevestig eerst je e-mailadres via de link in je mail.'],
  [/user already registered|already been registered/i, 'Er bestaat al een account met dit e-mailadres.'],
  [/password should be at least|weak password/i, 'Kies een sterker wachtwoord (minimaal 8 tekens).'],
  [/rate limit|too many requests/i, 'Even te veel pogingen. Wacht een minuut en probeer het opnieuw.'],
];

/** Looks like raw technical text (English driver/database output) rather than a message meant for users. */
const TECHNICAL = /permission denied|violates|relation |column |function |json|pgrst|syntax|sqlstate|exception|undefined|null value|constraint|schema cache|supabase|postgres|typeerror|cannot read|unexpected token|status code|\bat \w+ \(/i;

/**
 * Dutch, user-facing text for any error. `subject` (optional) names what failed, e.g. 'Kaart', 'Je vrienden',
 * 'Stories'; it prefixes the text ("Kaart: nu niet beschikbaar …").
 */
export function friendlyError(e: unknown, subject?: string): string {
  if (e == null || e === '') return '';
  const s = shape(e), msg = str(s.message).trim(), code = str(s.code);
  logOnce(e);
  for (const [re, text] of KNOWN) if (re.test(msg)) return text;
  const what = subject?.trim();
  const lead = (text: string) => (what ? `${what}: ${text}` : text.charAt(0).toUpperCase() + text.slice(1));
  switch (dbErrorKind(e)) {
    case 'permission': return lead('nu niet beschikbaar (de server geeft nog geen toegang). Probeer het later opnieuw.');
    case 'missing_table': case 'missing_column': case 'missing_function':
      return lead('nog niet beschikbaar (wordt nog ingesteld op de server). Probeer het later opnieuw.');
    case 'no_row': return lead('niet gevonden.');
    case 'rls': return 'Dit is niet toegestaan.';
    case 'network': return 'Geen verbinding met de server. Controleer je internet en probeer het opnieuw.';
    case 'auth': return 'Je sessie is verlopen. Log opnieuw in.';
    case 'duplicate': return 'Dit bestaat al.';
    case 'invalid': return 'Ongeldige invoer. Controleer de gegevens en probeer het opnieuw.';
    case 'blocked': return 'Dit kan niet: deze interactie is geblokkeerd.';
    default:
      // App-thrown Errors (no database code) usually already carry a Dutch sentence: keep those.
      if (msg && !code && !TECHNICAL.test(msg)) return msg;
      return lead('er ging iets mis. Probeer het opnieuw.');
  }
}

const logged = new Set<string>();
function logOnce(e: unknown) {
  // Keep the raw error for debugging (Metro/Xcode console) without showing it to the user.
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  if (!dev) return;
  const s = shape(e), key = `${str(s.code)}|${str(s.message)}`;
  if (logged.has(key)) return;
  logged.add(key);
  console.warn('[db]', str(s.code) || '-', str(s.message));
}
