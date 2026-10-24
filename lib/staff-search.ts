/** Pure helpers for the staff user search (server RPC public.sx_staff_search_users). */

export const SEARCH_PAGE_SIZE = 25;
export const SEARCH_MAX_PAGE_SIZE = 50;
export const SEARCH_MAX_QUERY = 64;

export type UserSearchArgs = { p_query: string; p_limit: number; p_offset: number };

/** Trims, collapses whitespace and caps the query like the server does (left(trim(q), 64)). */
export function normalizeSearchQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_QUERY);
}

/** RPC arguments for page `page` (0-based). Wildcards are escaped server-side, so the text is sent as typed. */
export function buildUserSearchArgs(raw: string | null | undefined, page = 0, pageSize = SEARCH_PAGE_SIZE): UserSearchArgs {
  const size = Math.min(Math.max(Math.floor(pageSize) || SEARCH_PAGE_SIZE, 1), SEARCH_MAX_PAGE_SIZE);
  const safePage = Math.max(Math.floor(page) || 0, 0);
  return { p_query: normalizeSearchQuery(raw), p_limit: size, p_offset: safePage * size };
}

/** True when the server will also try an id-prefix match (same rule as the SQL: 4-36 hex/dash chars). */
export function isIdPrefixQuery(raw: string): boolean {
  return /^[0-9a-f-]{4,36}$/i.test(normalizeSearchQuery(raw));
}

export type PageInfo = { from: number; to: number; total: number; page: number; pages: number; hasPrev: boolean; hasNext: boolean };

/** "1-25 van 130" style paging info from the window total_count returned with every row. */
export function pageInfo(total: number, page: number, pageSize = SEARCH_PAGE_SIZE, rowsOnPage?: number): PageInfo {
  const safeTotal = Math.max(0, Math.floor(total) || 0);
  const pages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const safePage = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1);
  const from = safeTotal === 0 ? 0 : safePage * pageSize + 1;
  const to = safeTotal === 0 ? 0 : Math.min(safeTotal, safePage * pageSize + (rowsOnPage ?? pageSize));
  return { from, to, total: safeTotal, page: safePage, pages, hasPrev: safePage > 0, hasNext: safePage < pages - 1 };
}

/** The total_count column of the first row (0 when there are no rows). */
export function totalFromRows(rows: readonly { total_count?: number | string | null }[] | null | undefined): number {
  const first = rows?.[0]?.total_count;
  const n = typeof first === 'string' ? Number(first) : first ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

/** PostgREST / Postgres errors meaning "this RPC or column does not exist yet" (migration not applied). */
export function isMissingBackend(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code && ['PGRST202', 'PGRST204', '42883', '42703', '42P01'].includes(error.code)) return true;
  return /could not find the function|does not exist|schema cache/i.test(error.message ?? '');
}
