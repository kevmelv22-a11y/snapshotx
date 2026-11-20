/** Mini-game in a 1-on-1 chat (Snapchat-style "Games" in chat): Boter, kaas en eieren (tic-tac-toe).
 *  - Every move is a normal `text` message whose body is `[game]{"g":"bke","id":"…","x":"<starter uid>","b":"x-o------"}`
 *    with the FULL board, so a game still works when older moves disappear with the chat's 24h rule.
 *  - The starter plays ❌ and moves first; the friend plays ⭕. Clients replay the moves in time order and only accept a
 *    move that is legal (right player by the server-set sender_id, exactly one new mark, game not finished), so a
 *    tampered message is simply ignored. No new table or migration. No I/O here. */
export const GAME_PREFIX = '[game]';
export const GAME_LABEL = { title: 'Boter, kaas en eieren', start: 'Spelletje starten', preview: '🎮 Boter, kaas en eieren', button: 'Spelletje' } as const;
export type Cell = 'x' | 'o' | '-';
export type GameMsg = { game: 'bke'; id: string; x: string; board: Cell[] };
export type GameState = GameMsg & { messageId: string; turn: 'x' | 'o' | null; winner: 'x' | 'o' | 'draw' | null; line: number[] | null; moves: number };
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ID_RE = /^[a-z0-9-]{4,40}$/i;

export function gameBody(g: { id: string; x: string; board: readonly Cell[] }): string {
  return GAME_PREFIX + JSON.stringify({ g: 'bke', id: g.id, x: g.x, b: g.board.join('') });
}
export function newGameBody(id: string, starter: string): string { return gameBody({ id, x: starter, board: Array(9).fill('-') as Cell[] }); }
export function parseGame(body: string | null | undefined): GameMsg | null {
  if (typeof body !== 'string' || !body.startsWith(GAME_PREFIX)) return null;
  try {
    const v = JSON.parse(body.slice(GAME_PREFIX.length)) as { g?: unknown; id?: unknown; x?: unknown; b?: unknown };
    if (v.g !== 'bke' || typeof v.id !== 'string' || !ID_RE.test(v.id) || typeof v.x !== 'string' || !v.x || typeof v.b !== 'string' || !/^[xo-]{9}$/.test(v.b)) return null;
    return { game: 'bke', id: v.id, x: v.x, board: v.b.split('') as Cell[] };
  } catch { return null; }
}
const count = (b: readonly Cell[], c: Cell) => b.filter(x => x === c).length;
export function outcome(board: readonly Cell[]): { winner: 'x' | 'o' | 'draw' | null; line: number[] | null } {
  for (const l of LINES) { const [a, b, c] = l; if (board[a] !== '-' && board[a] === board[b] && board[a] === board[c]) return { winner: board[a] as 'x' | 'o', line: l }; }
  return { winner: board.every(c => c !== '-') ? 'draw' : null, line: null };
}
/** The mark this user plays (starter = x). */
export const markOf = (g: { x: string }, userId: string): 'x' | 'o' => (g.x === userId ? 'x' : 'o');
function stateOf(m: GameMsg, messageId: string): GameState {
  const o = outcome(m.board), xs = count(m.board, 'x'), os = count(m.board, 'o');
  return { ...m, messageId, ...o, moves: xs + os, turn: o.winner ? null : xs === os ? 'x' : 'o' };
}
type Row = { id: string; sender_id: string; body: string | null; created_at: string; kind?: string; unsent_at?: string | null };
/** Replays all game messages of a chat (any order in) → current state per game id + the ids of accepted messages. */
export function replayGames(rows: readonly Row[]): { games: Map<string, GameState>; accepted: Set<string> } {
  const games = new Map<string, GameState>(), accepted = new Set<string>();
  const list = rows.filter(r => (r.kind ?? 'text') === 'text' && !r.unsent_at).map(r => ({ r, g: parseGame(r.body) })).filter((x): x is { r: Row; g: GameMsg } => !!x.g)
    .sort((a, b) => Date.parse(a.r.created_at) - Date.parse(b.r.created_at) || a.r.id.localeCompare(b.r.id));
  for (const { r, g } of list) {
    const prev = games.get(g.id), xs = count(g.board, 'x'), os = count(g.board, 'o'), mark = markOf(g, r.sender_id);
    if (xs !== os && xs !== os + 1) continue;
    if (!prev) {
      // First message we still have: an empty board must come from the starter; otherwise the sender made the last mark.
      const empty = xs + os === 0;
      if (empty ? r.sender_id !== g.x : mark !== (xs === os ? 'o' : 'x')) continue;
      if (outcome(g.board).line && empty) continue;
    } else {
      if (prev.x !== g.x || prev.winner || prev.turn !== mark) continue;
      const diff = g.board.map((c, i) => (c !== prev.board[i] ? i : -1)).filter(i => i >= 0);
      if (diff.length !== 1 || prev.board[diff[0]] !== '-' || g.board[diff[0]] !== mark) continue;
    }
    games.set(g.id, stateOf(g, r.id)); accepted.add(r.id);
  }
  return { games, accepted };
}
/** Board after my tap, or an error (Dutch). */
export function playMove(s: GameState, me: string, cell: number): { ok: true; body: string } | { ok: false; error: string } {
  if (s.winner) return { ok: false, error: 'Dit spel is al afgelopen.' };
  if (s.turn !== markOf(s, me)) return { ok: false, error: 'Wacht op je vriend, die is aan de beurt.' };
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell] !== '-') return { ok: false, error: 'Kies een leeg vakje.' };
  const board = [...s.board]; board[cell] = markOf(s, me);
  return { ok: true, body: gameBody({ id: s.id, x: s.x, board }) };
}
/** Status line under the board. */
export function gameStatus(s: GameState, me: string, friendName: string): string {
  const mine = markOf(s, me);
  if (s.winner === 'draw') return 'Gelijkspel! 🤝';
  if (s.winner) return s.winner === mine ? 'Jij hebt gewonnen! 🎉' : `${friendName} heeft gewonnen`;
  if (!s.moves) return s.turn === mine ? 'Jij begint ❌' : `${friendName} begint`;
  return s.turn === mine ? 'Jij bent aan de beurt' : `${friendName} is aan de beurt`;
}
export const CELL_EMOJI: Record<Cell, string> = { x: '❌', o: '⭕', '-': '' };
/** Preview in the chat list. */
export function gamePreview(g: GameMsg): string {
  const o = outcome(g.board);
  return o.winner ? `${GAME_LABEL.preview} · afgelopen` : count(g.board, 'x') + count(g.board, 'o') === 0 ? `${GAME_LABEL.preview} · nieuw spel` : `${GAME_LABEL.preview} · zet gedaan`;
}
export function newGameId(rand: () => number = Math.random, now = Date.now()): string {
  return `g${now.toString(36)}-${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}`;
}
