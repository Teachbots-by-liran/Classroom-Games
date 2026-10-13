// The main game screen: the board of tiles, the scoreboard, the timer and the host's buttons.
// The keys for this screen are listed in HELP below (press ? in the game to see them).

import { esc, fitBlock } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys, teamKey, toggleFullscreen } from '../shared/keys.js';
import { Scoreboard, formatChange } from '../shared/scoreboard.js';
import { timerDisplay } from '../shared/timer.js';
import { sound } from '../shared/sound.js';
import { toast } from '../shared/toast.js';
import { chooseDialog } from '../shared/dialog.js';
import { toggleHelp } from '../shared/help-overlay.js';
import { isDailyDouble, isUsed, markUsed, nextTurn, saveGame, tilesLeft, undoScore } from './game-state.js';
import { WARN_SECONDS, createGameTimer, toggleSound as switchSound } from './host-tools.js';
import { maxBet, showDailyDouble } from './daily-double.js';
import { openQuestion } from './question-screen.js';

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
  { title: 'Daily Double', keys: [
    ['0–9', 'Type the bet'],
    ['↑ / ↓', 'Bet 100 more / less'],
    ['T', 'Another team bets'],
    ['Enter', 'Lock the bet in'],
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

// onBoardDone(): every tile has been played (or the host chose to finish early) — go to the Final Round or winners.
// onWinners(): skip straight to the winners. onNewGame(): back to setup.
export function showBoard(app, game, { onNewGame, onBoardDone, onWinners }) {
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
            <button class="ctrl ctrl-small" data-action="new" title="Finish the game / new game">${ICONS.exit}</button>
            <button class="ctrl ctrl-small" data-action="help" title="Keys (?)">${ICONS.help}</button>
          </div>
        </div>
      </footer>
    </div>`;
  const screen = app.querySelector('.game');
  const boardEl = screen.querySelector('.board');

  // ---------- Timer (shared by the board and the open question) ----------
  const timer = createGameTimer(game.timerSeconds);
  const stopTimerDisplay = timerDisplay(screen.querySelector('.ctrl-timer'), timer, { warnAt: WARN_SECONDS });

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
    if (isDailyDouble(game, c, r)) {
      const team = game.turn;
      game.open.dd = { team, wager: Math.min(game.board.categories[c].questions[r].points, maxBet(game, team)), locked: false };
    }
    saveGame(game);
    showQuestion(tileEl);
  }

  function showQuestion(tileEl) {
    questionOpen = true;
    timer.reset(game.timerSeconds);
    const dd = game.open.dd;
    if (dd && !dd.locked) {
      // Daily Double: reveal and bet first, then the question opens underneath.
      showDailyDouble(screen, game, {
        tileEl,
        onLocked: () => openQ(tileEl, true),
        onCancel: () => {
          game.open = null;
          saveGame(game);
          questionOpen = false;
        },
      });
      return;
    }
    if (tileEl) sound.play('open');
    openQ(tileEl, false);
  }

  function openQ(tileEl, skipIntro) {
    openQuestion(screen, game, {
      tileEl,
      skipIntro,
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
        if (result === 'done' && tilesLeft(game) === 0) setTimeout(() => leave(onBoardDone), 900);
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
    switchSound();
    showSoundButton();
  }

  // Leave the board screen for another screen.
  function leave(next) {
    popKeys();
    stopTimerDisplay();
    timer.reset();
    next();
  }

  // The door button: finish the game early, or start a new one.
  async function gameMenu() {
    timer.pause();
    const options = [];
    if (game.finalRound) options.push({ label: 'Go to the Final Round', value: 'final', primary: true });
    options.push({ label: 'Show the winners', value: 'winners', primary: !game.finalRound });
    options.push({ label: 'New game (scores are lost)', value: 'new', danger: true });
    options.push({ label: 'Keep playing', value: null });
    const choice = await chooseDialog({ title: 'Finish the game?', options });
    if (choice === 'final') leave(onBoardDone);
    if (choice === 'winners') leave(onWinners);
    if (choice === 'new') leave(onNewGame);
  }

  screen.querySelector('.controls').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.dataset.action) {
      case 'timer': timer.toggle(); break;
      case 'undo': undo(); break;
      case 'sound': toggleSound(); break;
      case 'new': gameMenu(); break;
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
