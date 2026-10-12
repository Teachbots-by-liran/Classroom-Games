// The main game screen: the board of tiles and the scoreboard underneath.
//
// Keys: 1-6 = make it that team's turn · T = next team's turn · U = undo last score · F = full screen

import { esc, fitBlock } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys, teamKey, toggleFullscreen } from '../shared/keys.js';
import { Scoreboard, formatChange } from '../shared/scoreboard.js';
import { toast } from '../shared/toast.js';
import { confirmDialog } from '../shared/dialog.js';
import { isUsed, markUsed, nextTurn, saveGame, undoScore } from './game-state.js';
import { openQuestion } from './question-screen.js';

export function showBoard(app, game, { onNewGame }) {
  const { board } = game;
  const rows = Math.max(...board.categories.map(c => c.questions.length));

  app.innerHTML = `
    <div class="screen game">
      <section class="board" style="--cols:${board.categories.length}; --rows:${rows}"></section>
      <footer class="bar">
        <div class="controls">
          <div class="ctrl ctrl-timer">${ICONS.timer}<span class="timer-num">${game.timerSeconds}</span></div>
          <div class="ctrl-grid">
            <button class="ctrl ctrl-small" data-action="undo" title="Undo last score change (U)">${ICONS.undo}</button>
            <button class="ctrl ctrl-small" data-action="sound" title="Sound on/off (M)">${ICONS.sound}</button>
            <button class="ctrl ctrl-small" data-action="new" title="End this game and start a new one">${ICONS.exit}</button>
            <button class="ctrl ctrl-small" data-action="help" title="Help (?)">${ICONS.help}</button>
          </div>
        </div>
      </footer>
    </div>`;
  const screen = app.querySelector('.game');
  const boardEl = screen.querySelector('.board');

  // ---------- Board ----------
  function renderBoard() {
    let html = board.categories.map(cat => `<div class="cat"><span>${esc(cat.name)}</span></div>`).join('');
    for (let r = 0; r < rows; r++) {
      board.categories.forEach((cat, c) => {
        const q = cat.questions[r];
        if (!q) html += `<div class="tile empty"></div>`;
        else if (isUsed(game, c, r)) html += `<div class="tile used" data-cat="${c}" data-row="${r}" aria-label="played"></div>`;
        else html += `<button class="tile" data-cat="${c}" data-row="${r}"><span class="pts">${q.points}</span></button>`;
      });
    }
    boardEl.innerHTML = html;
    document.fonts.ready.then(() => boardEl.querySelectorAll('.cat').forEach(el => fitBlock(el)));
  }

  // ---------- Scoreboard ----------
  const bar = screen.querySelector('.bar');
  const scoreboard = new Scoreboard(bar, { onTeamClick: setTurn });
  bar.prepend(scoreboard.el);

  function renderScores(animate = true) {
    scoreboard.render(game.teams, game.turn, { animate });
  }

  function setTurn(i) {
    if (i >= game.teams.length) return;
    game.turn = i;
    saveGame(game);
    renderScores(false);
  }

  // ---------- Questions ----------
  let questionOpen = false;

  function open(c, r, tileEl) {
    if (questionOpen) return;
    questionOpen = true;
    game.open = { c, r, revealed: false };
    saveGame(game);
    showQuestion(tileEl);
  }

  function showQuestion(tileEl) {
    questionOpen = true;
    openQuestion(screen, game, {
      tileEl,
      onClose: async (result, animateAway) => {
        const { c, r } = game.open;
        game.open = null;
        if (result === 'done') {
          markUsed(game, c, r);
          nextTurn(game);
        }
        saveGame(game);
        await animateAway();
        renderBoard();
        renderScores(false);
        const tile = boardEl.querySelector(`[data-cat="${c}"][data-row="${r}"]`);
        if (result === 'done' && tile) tile.classList.add('just-used');
        questionOpen = false;
      },
    });
  }

  boardEl.addEventListener('click', e => {
    const tile = e.target.closest('button.tile');
    if (tile) open(Number(tile.dataset.cat), Number(tile.dataset.row), tile);
  });

  // ---------- Controls ----------
  function undo() {
    const last = undoScore(game);
    if (!last) return toast(`${ICONS.undo} Nothing to undo`);
    renderScores();
    toast(`${ICONS.undo} Undone: ${esc(game.teams[last.team].name)} ${formatChange(last.delta)}`);
  }

  async function newGame() {
    const sure = await confirmDialog({
      title: 'End this game?', text: 'The scores will be lost.', ok: 'End game', cancel: 'Keep playing', danger: true,
    });
    if (sure) {
      popKeys();
      onNewGame();
    }
  }

  screen.querySelector('.controls').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'undo') undo();
    if (btn.dataset.action === 'new') newGame();
  });

  const popKeys = pushKeys(e => {
    const team = teamKey(e);
    if (team >= 0 && !e.shiftKey) { setTurn(team); return true; }
    switch (e.key.toLowerCase()) {
      case 't': nextTurn(game); saveGame(game); renderScores(false); return true;
      case 'u': undo(); return true;
      case 'f': toggleFullscreen(); return true;
    }
    return false;
  });

  // ---------- First draw ----------
  renderBoard();
  renderScores(false);
  if (game.open) showQuestion(null); // the page was refreshed while a question was open
}
