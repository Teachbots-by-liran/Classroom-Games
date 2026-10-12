// The main game screen: the board of tiles, the scoreboard, the timer and the host's buttons.
// The keys for this screen are listed in HELP below (press ? in the game to see them).

import { esc, fitBlock } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys, teamKey, toggleFullscreen } from '../shared/keys.js';
import { Scoreboard, formatChange } from '../shared/scoreboard.js';
import { CountdownTimer, timerDisplay } from '../shared/timer.js';
import { sound } from '../shared/sound.js';
import { toast } from '../shared/toast.js';
import { confirmDialog } from '../shared/dialog.js';
import { toggleHelp } from '../shared/help-overlay.js';
import { isUsed, markUsed, nextTurn, saveGame, undoScore } from './game-state.js';
import { openQuestion } from './question-screen.js';

const WARN_SECONDS = 5;

export const HELP = [
  { title: 'Anytime', keys: [
    ['Space', 'Start / pause the timer'],
    ['R', 'Reset the timer'],
    ['U', 'Undo the last score change'],
    ['M', 'Sound on / off'],
    ['F', 'Full screen on / off'],
    ['?', 'Show / hide this help'],
  ] },
  { title: 'Board', keys: [
    ['Click', 'Open a question'],
    ['1–6', 'Give that team the turn'],
    ['T', 'Next team’s turn'],
  ] },
  { title: 'Question', keys: [
    ['A', 'Show the answer'],
    ['1–6', 'Correct: give that team the points'],
    ['Shift+1–6', 'Wrong: take that team’s points'],
    ['Click', 'A choice a team calls out'],
    ['Esc', 'Done, back to the board'],
    ['Backspace', 'Put the tile back unplayed'],
  ] },
];

export function showBoard(app, game, { onNewGame }) {
  const { board } = game;
  const rows = Math.max(...board.categories.map(c => c.questions.length));

  app.innerHTML = `
    <div class="screen game">
      <section class="board" style="--cols:${board.categories.length}; --rows:${rows}"></section>
      <footer class="bar">
        <div class="controls">
          <button class="ctrl ctrl-timer" data-action="timer" title="Start / pause the timer (Space). Reset: R"></button>
          <div class="ctrl-grid">
            <button class="ctrl ctrl-small" data-action="undo" title="Undo last score change (U)">${ICONS.undo}</button>
            <button class="ctrl ctrl-small" data-action="sound" title="Sound on/off (M)"></button>
            <button class="ctrl ctrl-small" data-action="new" title="End this game and start a new one">${ICONS.exit}</button>
            <button class="ctrl ctrl-small" data-action="help" title="Keys (?)">${ICONS.help}</button>
          </div>
        </div>
      </footer>
    </div>`;
  const screen = app.querySelector('.game');
  const boardEl = screen.querySelector('.board');

  // ---------- Timer (shared by the board and the open question) ----------
  const timer = new CountdownTimer(game.timerSeconds, {
    onSecond: s => sound.play(s <= WARN_SECONDS ? 'tickLoud' : 'tick'),
    onEnd: timesUp,
  });
  timerDisplay(screen.querySelector('.ctrl-timer'), timer, { warnAt: WARN_SECONDS });

  function timesUp() {
    sound.play('timeUp');
    const banner = document.createElement('div');
    banner.className = 'times-up';
    banner.innerHTML = `<div class="times-up-inner">${ICONS.timer}<span>TIME'S UP!</span></div>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2200);
  }

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
    if (i >= game.teams.length || i === game.turn) return;
    game.turn = i;
    saveGame(game);
    sound.play('turn');
    renderScores(false);
  }

  // ---------- Questions ----------
  let questionOpen = false;

  function open(c, r, tileEl) {
    if (questionOpen) return;
    game.open = { c, r, revealed: false };
    saveGame(game);
    showQuestion(tileEl);
  }

  function showQuestion(tileEl) {
    questionOpen = true;
    timer.reset(game.timerSeconds);
    if (tileEl) sound.play('open');
    openQuestion(screen, game, {
      tileEl,
      timer,
      warnAt: WARN_SECONDS,
      onClose: async (result, animateAway) => {
        const { c, r } = game.open;
        game.open = null;
        timer.reset(game.timerSeconds);
        if (result === 'done') {
          markUsed(game, c, r);
          nextTurn(game);
        }
        saveGame(game);
        sound.play('close');
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
    sound.play('undo');
    renderScores();
    toast(`${ICONS.undo} Undone: ${esc(game.teams[last.team].name)} ${formatChange(last.delta)}`);
    return last;
  }

  const soundBtn = screen.querySelector('[data-action="sound"]');
  function showSoundButton() {
    soundBtn.innerHTML = sound.muted ? ICONS.muted : ICONS.sound;
    soundBtn.classList.toggle('off', sound.muted);
    soundBtn.setAttribute('aria-pressed', String(!sound.muted));
  }
  function toggleSound() {
    const muted = sound.toggleMute();
    showSoundButton();
    toast(muted ? `${ICONS.muted} Sound off` : `${ICONS.sound} Sound on`, 1400);
  }

  async function newGame() {
    timer.pause();
    const sure = await confirmDialog({
      title: 'End this game?', text: 'The scores will be lost.', ok: 'End game', cancel: 'Keep playing', danger: true,
    });
    if (sure) {
      popKeys();
      timer.reset();
      onNewGame();
    }
  }

  screen.querySelector('.controls').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'timer': timer.toggle(); break;
      case 'undo': undo(); break;
      case 'sound': toggleSound(); break;
      case 'new': newGame(); break;
      case 'help': toggleHelp(HELP); break;
    }
  });

  // Keys for the whole game. An open question handles its own keys first (see question-screen.js).
  const popKeys = pushKeys(e => {
    if (e.key === '?') { toggleHelp(HELP); return true; }
    if (e.code === 'Space') { timer.toggle(); return true; }
    const team = teamKey(e);
    if (team >= 0 && !e.shiftKey && !questionOpen) { setTurn(team); return true; }
    switch (e.key.toLowerCase()) {
      case 'r': timer.reset(game.timerSeconds); return true;
      case 'm': toggleSound(); return true;
      case 'f': toggleFullscreen(); return true;
      case 'u': if (!questionOpen) undo(); return !questionOpen;
      case 't': if (!questionOpen) { nextTurn(game); saveGame(game); sound.play('turn'); renderScores(false); } return true;
    }
    return false;
  });

  // ---------- First draw ----------
  showSoundButton();
  renderBoard();
  renderScores(false);
  if (game.open) showQuestion(null); // the page was refreshed while a question was open
}
