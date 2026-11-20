import assert from 'node:assert/strict';
import test from 'node:test';
import * as G from './chat-games.ts';
import { chatPreviewText } from './avatar/poses.ts';

const A = 'aaaa-1', B = 'bbbb-2';
let t = 0;
const msg = (sender, body) => ({ id: `m${++t}`, sender_id: sender, body, created_at: new Date(Date.UTC(2026, 10, 20, 12, 0, t)).toISOString(), kind: 'text' });

test('parse / body round trip and rejects junk', () => {
  const b = G.newGameBody('gabc-123', A);
  assert.deepEqual(G.parseGame(b), { game: 'bke', id: 'gabc-123', x: A, board: Array(9).fill('-') });
  for (const bad of ['hoi', '[game]{', '[game]{"g":"bke","id":"x","x":"a","b":"---------"}', '[game]{"g":"bke","id":"gabc-123","x":"a","b":"xxq------"}', null]) assert.equal(G.parseGame(bad), null);
  assert.match(G.newGameId(() => 0.5, 1e12), /^g[a-z0-9]+-[a-z0-9]{6}$/);
});
test('full game: alternate turns, illegal moves ignored, win detected', () => {
  const rows = [msg(A, G.newGameBody('gabc-123', A))];
  const step = (who, cell) => { const s = G.replayGames(rows).games.get('gabc-123'); const r = G.playMove(s, who, cell); assert.ok(r.ok, r.error); rows.push(msg(who, r.body)); };
  let s = G.replayGames(rows).games.get('gabc-123');
  assert.equal(s.turn, 'x'); assert.equal(G.gameStatus(s, A, 'Bo'), 'Jij begint ❌'); assert.equal(G.gameStatus(s, B, 'Ann'), 'Ann begint');
  assert.equal(G.playMove(s, B, 0).ok, false);
  step(A, 0); step(B, 4);
  // B cheats: two marks at once / out of turn -> ignored
  rows.push(msg(B, G.gameBody({ id: 'gabc-123', x: A, board: ['x', 'o', 'o', '-', 'o', '-', '-', '-', '-'] })));
  s = G.replayGames(rows).games.get('gabc-123'); assert.equal(s.moves, 2); assert.equal(s.turn, 'x');
  step(A, 1); step(B, 8); step(A, 2);
  s = G.replayGames(rows).games.get('gabc-123');
  assert.equal(s.winner, 'x'); assert.deepEqual(s.line, [0, 1, 2]); assert.equal(s.turn, null);
  assert.equal(G.gameStatus(s, A, 'Bo'), 'Jij hebt gewonnen! 🎉'); assert.equal(G.gameStatus(s, B, 'Ann'), 'Ann heeft gewonnen');
  assert.equal(G.playMove(s, B, 5).ok, false);
  assert.equal(G.replayGames(rows).accepted.size, 6);
});
test('works when older moves are gone; draw; previews', () => {
  const mid = msg(B, G.gameBody({ id: 'gdef-456', x: A, board: ['x', 'o', '-', '-', '-', '-', '-', '-', '-'] }));
  assert.equal(G.replayGames([mid]).games.get('gdef-456').turn, 'x');
  const wrong = msg(A, G.gameBody({ id: 'gdef-457', x: A, board: ['x', 'o', '-', '-', '-', '-', '-', '-', '-'] }));
  assert.equal(G.replayGames([wrong]).games.size, 0);
  assert.equal(G.replayGames([msg(B, G.newGameBody('gdef-458', A))]).games.size, 0);
  assert.equal(G.outcome('xoxxoooxx'.split('')).winner, 'draw');
  assert.equal(chatPreviewText(G.newGameBody('gabc-123', A)), '🎮 Boter, kaas en eieren · nieuw spel');
});

import { canEdit } from './chat-edits.ts';
import { canForward } from './chat-forward.ts';
test('game moves cannot be edited or forwarded', () => {
  const m = { id: 'x', sender_id: A, kind: 'text', body: G.newGameBody('gabc-123', A), created_at: new Date().toISOString(), unsent_at: null };
  assert.equal(canEdit(m, A, Date.now()), false);
  assert.equal(canForward(m, Date.now()), false);
});
