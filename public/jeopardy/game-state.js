// Everything about the game in progress: scores, used tiles, whose turn it is, score history.
// It is saved after every change, so refreshing the page brings you back to the same moment.

import { createSavedState } from '../shared/saved-state.js';

const store = createSavedState('jeopardy-game');
const VERSION = 1;
const RESUME_HOURS = 6; // a saved game older than this is offered on the setup screen instead of reopening by itself

export function newGame({ board, teams, turn, finalRound, timerSeconds }) {
  return {
    version: VERSION,
    savedAt: Date.now(),
    board,            // a full copy of the board, so editing the file mid-game changes nothing
    teams,            // [{ name, score }]
    turn,             // index of the team that picks next
    finalRound,
    timerSeconds,
    used: [],         // tiles already played, as "category-row" keys
    dailyDouble: pickDailyDouble(board),
    history: [],      // score changes, newest last, for undo: { team, delta }
    open: null,       // the question on screen: { c, r, revealed }
    phase: 'board',   // 'board' → 'final' (optional) → 'winners'
    final: null,      // Final Round progress, see startFinal()
  };
}

// The Daily Double hides on a higher-value tile (rows 3-5), unless the board file fixes its place.
function pickDailyDouble(board) {
  if (board.dailyDouble === 'none') return null;
  if (typeof board.dailyDouble === 'object') return { c: board.dailyDouble.category, r: board.dailyDouble.question };
  const tiles = [];
  board.categories.forEach((cat, c) => cat.questions.forEach((_, r) => tiles.push({ c, r })));
  const high = tiles.filter(t => t.r >= 2);
  const pool = high.length ? high : tiles;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

export function saveGame(game) {
  game.savedAt = Date.now();
  store.save(game);
}

export function loadGame() {
  const game = store.load();
  return game && game.version === VERSION && game.board ? game : null;
}

export function clearGame() {
  store.clear();
}

// Was the game saved recently enough to reopen straight away (a refresh during the lesson)?
export function isRecent(game) {
  return Date.now() - game.savedAt < RESUME_HOURS * 60 * 60 * 1000;
}

export const tileKey = (c, r) => c + '-' + r;
export const isUsed = (game, c, r) => game.used.includes(tileKey(c, r));
export const isDailyDouble = (game, c, r) => !!game.dailyDouble && game.dailyDouble.c === c && game.dailyDouble.r === r;

export function markUsed(game, c, r) {
  if (!isUsed(game, c, r)) game.used.push(tileKey(c, r));
}

export function tilesLeft(game) {
  const total = game.board.categories.reduce((n, cat) => n + cat.questions.length, 0);
  return total - game.used.length;
}

export function changeScore(game, team, delta) {
  game.teams[team].score += delta;
  game.history.push({ team, delta });
  saveGame(game);
}

// Take back the last score change. Returns what was undone, or null if there is nothing to undo.
export function undoScore(game) {
  const last = game.history.pop();
  if (!last) return null;
  game.teams[last.team].score -= last.delta;
  saveGame(game);
  return last;
}

export function nextTurn(game) {
  game.turn = (game.turn + 1) % game.teams.length;
}

// ---------- Final Round ----------

export function startFinal(game) {
  game.phase = 'final';
  game.final = game.final || {
    stage: 'category', // 'category' → 'wagers' → 'question'
    wagers: {},        // team index → secret bet
    marks: {},         // team index → 'right' | 'wrong'
    base: null,        // scores before the Final Round results, so a mark can be changed
    revealed: false,
  };
  saveGame(game);
}

export function showWinners(game) {
  game.phase = 'winners';
  saveGame(game);
}

// Teams sorted by score, with their place. Teams with the same score share a place.
export function ranking(game) {
  const sorted = game.teams.map((t, i) => ({ ...t, index: i })).sort((a, b) => b.score - a.score);
  let place = 0;
  return sorted.map((t, i) => {
    if (i === 0 || t.score < sorted[i - 1].score) place = i + 1;
    return { ...t, place };
  });
}
