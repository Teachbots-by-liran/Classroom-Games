// The Final Round, in three stages:
//   1. category — a big reveal of the category; teams write a secret bet on paper
//   2. wagers   — the host types each team's bet (shown as dots, so the class can't read them)
//   3. question — the question and timer; the host marks each team right or wrong and their bet is revealed
// Then the winners. Bet limit (classroom rules): the team's score, or the highest tile value if that is more.
//
// Keys (question stage): A = answer · 1-6 = right · Shift+1-6 = wrong · Space / R = timer · Enter = winners

import { esc, fitBlock, fitText } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys, teamKey, toggleFullscreen } from '../shared/keys.js';
import { Scoreboard, formatScore } from '../shared/scoreboard.js';
import { teamBadge, teamLook } from '../shared/team-looks.js';
import { timerDisplay } from '../shared/timer.js';
import { sound } from '../shared/sound.js';
import { chooseDialog } from '../shared/dialog.js';
import { toggleHelp } from '../shared/help-overlay.js';
import { saveGame } from './game-state.js';
import { maxBet } from './daily-double.js';
import { choicesHtml } from './question-screen.js';
import { WARN_SECONDS, createGameTimer, toggleSound } from './host-tools.js';

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

const HELP = [
  { title: 'Final Round', keys: [
    ['Enter', 'Next step'],
    ['A', 'Show the answer'],
    ['1–6', 'Team was right'],
    ['Shift+1–6', 'Team was wrong'],
  ] },
  { title: 'Anytime', keys: [
    ['Space', 'Start / pause the timer'],
    ['R', 'Reset the timer'],
    ['M', 'Sound on / off'],
    ['F', 'Full screen on / off'],
  ] },
];

export function showFinalRound(app, game, { onWinners, onBackToBoard, onNewGame }) {
  const fr = game.final;
  const final = game.board.final;
  let popKeys = () => {};
  let cleanup = () => {};

  function go(stage, animate = true) {
    popKeys();
    cleanup();
    fr.stage = stage;
    saveGame(game);
    if (stage === 'category') showCategory(animate);
    if (stage === 'wagers') showWagers();
    if (stage === 'question') showQuestion();
  }

  // The door button: back to the board, straight to the winners, or a new game.
  async function menu() {
    const options = [{ label: 'Show the winners', value: 'winners', primary: true }];
    if (fr.stage !== 'question' || !fr.base) options.push({ label: 'Back to the board', value: 'board' });
    options.push({ label: 'New game (scores are lost)', value: 'new', danger: true });
    options.push({ label: 'Keep playing', value: null });
    const choice = await chooseDialog({ title: 'Final Round', options });
    if (!choice) return;
    popKeys();
    cleanup();
    if (choice === 'winners') onWinners();
    if (choice === 'board') onBackToBoard();
    if (choice === 'new') onNewGame();
  }

  // Keys that work on every stage.
  function commonKey(e) {
    if (e.key === '?') { toggleHelp(HELP); return true; }
    switch (e.key.toLowerCase()) {
      case 'm': toggleSound(); return true;
      case 'f': toggleFullscreen(); return true;
    }
    return false;
  }

  // ---------- 1. Category ----------
  function showCategory(animate) {
    app.innerHTML = `
      <div class="screen final final-intro${animate && !REDUCED_MOTION ? '' : ' no-intro'}">
        <div class="dd-lights" aria-hidden="true"><span></span><span></span><span></span></div>
        <button class="q-btn final-menu" data-action="menu" title="Finish the game">${ICONS.exit}</button>
        <h1 class="final-title"><span>Final</span><span>Round</span></h1>
        <div class="final-cat"><span>${esc(final.category)}</span></div>
        <div class="final-note">${ICONS.pencil}<span>Write your secret bet</span></div>
        <button class="start-btn final-next" data-action="next">BETS ${ICONS.play}</button>
      </div>`;
    const root = app.querySelector('.final');
    document.fonts.ready.then(() => fitText(root.querySelector('.final-cat span'), 20));
    if (animate) sound.play('sting');
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'menu') menu();
      if (a === 'next') go('wagers');
    });
    popKeys = pushKeys(e => {
      if (e.key === 'Enter') { go('wagers'); return true; }
      return commonKey(e);
    });
  }

  // ---------- 2. Secret bets ----------
  function showWagers() {
    app.innerHTML = `
      <div class="screen final final-wagers">
        <header class="final-head">
          <button class="q-btn" data-action="menu" title="Finish the game">${ICONS.exit}</button>
          <div class="final-head-title"><span class="q-dd">Final Round</span><span class="q-cat">${esc(final.category)}</span></div>
          <button class="q-btn" data-action="back" title="Back to the category">${ICONS.undo}</button>
        </header>
        <div class="wager-grid" style="--n:${game.teams.length}">
          ${game.teams.map((t, i) => `
            <label class="wager-card" style="--team:${teamLook(i).color}">
              <span class="wager-team">${teamBadge(i)}<span class="wager-name">${esc(t.name)}</span><span class="wager-score">${formatScore(t.score)}</span></span>
              <span class="wager-entry">
                <input class="wager-input" data-team="${i}" type="password" inputmode="numeric" autocomplete="off" maxlength="5"
                  value="${fr.wagers[i] ?? ''}" aria-label="${esc(t.name)} bet">
                <span class="wager-status"></span>
              </span>
              <span class="wager-max">Max ${maxBet(game, i).toLocaleString('en-US')}</span>
            </label>`).join('')}
        </div>
        <button class="start-btn final-next" data-action="next" disabled>QUESTION ${ICONS.play}</button>
      </div>`;
    const root = app.querySelector('.final');
    const inputs = [...root.querySelectorAll('.wager-input')];
    document.fonts.ready.then(() => root.querySelectorAll('.wager-name').forEach(n => fitText(n, 12)));

    function check(input) {
      const i = Number(input.dataset.team);
      input.value = input.value.replace(/\D/g, '');
      const card = input.closest('.wager-card');
      const status = card.querySelector('.wager-status');
      const max = maxBet(game, i);
      const n = input.value === '' ? null : Number(input.value);
      const ok = n !== null && n <= max;
      card.classList.toggle('done', ok);
      card.classList.toggle('too-high', n !== null && n > max);
      status.innerHTML = ok ? ICONS.check : (n !== null ? ICONS.warning : '');
      status.title = n !== null && n > max ? `Too high: the most is ${max}` : '';
      if (ok) fr.wagers[i] = n; else delete fr.wagers[i];
      return ok;
    }
    function allDone() {
      const done = inputs.map(check).every(Boolean);
      root.querySelector('[data-action="next"]').disabled = !done;
      saveGame(game);
      return done;
    }

    root.addEventListener('input', e => {
      if (e.target.matches('.wager-input')) allDone();
    });
    root.addEventListener('keydown', e => {
      if (!e.target.matches('.wager-input') || e.key !== 'Enter') return;
      e.preventDefault();
      const next = inputs[inputs.indexOf(e.target) + 1];
      if (next) next.focus();
      else if (allDone()) go('question');
    });
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'menu') menu();
      if (a === 'back') go('category', false);
      if (a === 'next' && allDone()) go('question');
    });
    popKeys = pushKeys(e => {
      if (e.key === 'Enter' && allDone()) { go('question'); return true; }
      return commonKey(e);
    });
    allDone();
    (inputs.find(inp => inp.value === '') || inputs[0]).focus();
  }

  // ---------- 3. Question and results ----------
  function showQuestion() {
    if (!fr.base) fr.base = game.teams.map(t => t.score);
    const mc = Array.isArray(final.choices) && final.choices.length > 0;
    app.innerHTML = `
      <div class="screen final question final-question">
        <div class="q-inner">
          <header class="q-head">
            <button class="q-btn" data-action="menu" title="Finish the game">${ICONS.exit}</button>
            <div class="q-title"><span class="q-dd">Final Round</span><span class="q-cat">${esc(final.category)}</span></div>
            <button class="q-timer" data-action="timer" title="Start / pause the timer (Space). Reset: R"></button>
            <button class="final-winners" data-action="winners" hidden>${ICONS.trophy}<span>Winners</span></button>
          </header>
          <div class="q-body${final.image ? ' has-image' : ''}${mc ? ' has-choices' : ''}">
            ${final.image ? `<div class="q-image"><img src="${esc(final.image)}" alt=""></div>` : ''}
            <div class="q-side">
              <div class="q-text">
                ${final.quote ? `<blockquote class="q-quote" dir="auto">${esc(final.quote)}</blockquote>` : ''}
                ${final.question ? `<p class="q-question" dir="auto">${esc(final.question)}</p>` : ''}
              </div>
              ${mc ? choicesHtml(final) : ''}
              <div class="q-answer-slot">
                <button class="q-reveal" data-action="reveal">${ICONS.eye}<span>Answer</span><kbd>A</kbd></button>
                ${mc ? '' : `
                <div class="q-answer" hidden>
                  ${final.answerImage ? `<img class="q-answer-img" src="${esc(final.answerImage)}" alt="">` : ''}
                  <div class="q-answer-text">
                    <div class="q-answer-main" dir="auto">${ICONS.check}<span>${esc(final.answer)}</span></div>
                    ${final.explain ? `<div class="q-explain" dir="auto">${esc(final.explain)}</div>` : ''}
                  </div>
                </div>`}
              </div>
            </div>
          </div>
          <footer class="q-bar"></footer>
        </div>
      </div>`;
    const root = app.querySelector('.final');

    // Timer
    const timer = createGameTimer(game.timerSeconds);
    const timerEl = root.querySelector('.q-timer');
    const stopTimer = timerDisplay(timerEl, timer, { warnAt: WARN_SECONDS });
    const stopEdge = timer.subscribe(t => {
      root.classList.toggle('q-warning', timerEl.classList.contains('warning') && t.running);
      root.classList.toggle('q-timesup', t.done);
    });
    cleanup = () => { stopTimer(); stopEdge(); timer.reset(); };

    // Team cards: ✓ / ✗ with the amount hidden — the bet appears in the floating badge when marked.
    const scoreboard = new Scoreboard(root.querySelector('.q-bar'), {
      actions: { onPlus: i => mark(i, 'right'), onMinus: i => mark(i, 'wrong') },
    });
    scoreboard.setPoints(null);

    function applyMarks(animate) {
      game.teams.forEach((t, i) => {
        const w = fr.wagers[i] || 0;
        const m = fr.marks[i];
        t.score = fr.base[i] + (m === 'right' ? w : m === 'wrong' ? -w : 0);
      });
      scoreboard.setMarks(fr.marks);
      scoreboard.render(game.teams, null, { animate });
      const all = game.teams.every((_, i) => fr.marks[i]);
      root.querySelector('.final-winners').hidden = !all;
    }

    // Marking the same thing twice removes the mark (for misclicks).
    function mark(i, result) {
      if (i >= game.teams.length) return;
      fr.marks[i] = fr.marks[i] === result ? undefined : result;
      if (!fr.marks[i]) delete fr.marks[i];
      else sound.play(result === 'right' ? 'correct' : 'wrong');
      reveal();
      applyMarks(true);
      saveGame(game);
    }

    function reveal() {
      if (fr.revealed) return;
      fr.revealed = true;
      timer.pause();
      saveGame(game);
      sound.play('reveal');
      showAnswer(true);
    }

    function showAnswer(animate) {
      root.querySelector('.q-reveal').hidden = true;
      const answer = root.querySelector('.q-answer');
      if (answer) {
        answer.hidden = false;
        if (animate && !REDUCED_MOTION) answer.classList.add('pop');
      } else {
        root.querySelector('.q-answer-slot').classList.add('empty');
      }
      if (mc) {
        root.querySelector('.q-choices').classList.add('revealed');
        const right = root.querySelector(`.q-choice[data-choice="${final.correct}"]`);
        right.classList.add('correct');
        right.querySelector('.q-mark').innerHTML = ICONS.check;
      }
      fit();
    }

    function fit() {
      document.fonts.ready.then(() => {
        const text = root.querySelector('.q-text');
        if (text) fitBlock(text, 14);
        root.querySelectorAll('.q-choice-text').forEach(t => fitBlock(t, 12));
        const ans = root.querySelector('.q-answer-text');
        if (ans && !ans.closest('[hidden]')) fitBlock(ans, 14);
      });
    }

    function winners() {
      if (!game.teams.every((_, i) => fr.marks[i])) return;
      popKeys();
      cleanup();
      onWinners();
    }

    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'menu') menu();
      if (a === 'timer') timer.toggle();
      if (a === 'reveal') reveal();
      if (a === 'winners') winners();
    });
    popKeys = pushKeys(e => {
      const team = teamKey(e);
      if (team >= 0) { mark(team, e.shiftKey ? 'wrong' : 'right'); return true; }
      if (e.code === 'Space') { timer.toggle(); return true; }
      switch (e.key.toLowerCase()) {
        case 'a': reveal(); return true;
        case 'r': timer.reset(); return true;
        case 'enter': winners(); return true;
      }
      return commonKey(e);
    });

    if (fr.revealed) showAnswer(false);
    root.querySelectorAll('img').forEach(img => img.addEventListener('load', fit));
    applyMarks(false);
    fit();
  }

  go(fr.stage, fr.stage === 'category');
}
