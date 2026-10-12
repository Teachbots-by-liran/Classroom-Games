// The full-screen question: the tile flips and grows to fill the screen,
// the host reveals the answer and gives or takes points from any team.
//
// Keys: A = show answer · 1-6 = correct (give points) · Shift+1-6 = wrong (take points)
//       U = undo last score · Esc = done (tile is used) · Backspace = put the tile back unplayed

import { esc, fitBlock } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys, teamKey } from '../shared/keys.js';
import { Scoreboard, formatChange } from '../shared/scoreboard.js';
import { toast } from '../shared/toast.js';
import { changeScore, saveGame, undoScore } from './game-state.js';

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

// options: { tileEl (to animate from), onClose(result) } — result is 'done' or 'putback'
export function openQuestion(screen, game, { tileEl = null, onClose }) {
  const { c, r } = game.open;
  const cat = game.board.categories[c];
  const q = cat.questions[r];
  const points = q.points;

  const el = document.createElement('div');
  el.className = 'question';
  el.innerHTML = `
    <div class="q-inner">
      <header class="q-head">
        <button class="q-btn" data-action="putback" title="Put back: close without using this tile (Backspace)">${ICONS.undo}</button>
        <div class="q-title"><span class="q-cat">${esc(cat.name)}</span><span class="q-pts">${points}</span></div>
        <button class="q-btn" data-action="close" title="Done (Esc)">${ICONS.close}</button>
      </header>
      <div class="q-body${q.image ? ' has-image' : ''}">
        ${q.image ? `<div class="q-image"><img src="${esc(q.image)}" alt=""></div>` : ''}
        <div class="q-side">
          <div class="q-text">
            ${q.quote ? `<blockquote class="q-quote" dir="auto">${esc(q.quote)}</blockquote>` : ''}
            ${q.question ? `<p class="q-question" dir="auto">${esc(q.question)}</p>` : ''}
          </div>
          <div class="q-answer-slot">
        <button class="q-reveal" data-action="reveal">${ICONS.eye}<span>Answer</span><kbd>A</kbd></button>
        <div class="q-answer" hidden>
          ${q.answerImage ? `<img class="q-answer-img" src="${esc(q.answerImage)}" alt="">` : ''}
          <div class="q-answer-text">
            <div class="q-answer-main" dir="auto">${ICONS.check}<span>${esc(q.answer)}</span></div>
            ${q.explain ? `<div class="q-explain" dir="auto">${esc(q.explain)}</div>` : ''}
          </div>
        </div>
          </div>
        </div>
      </div>
      <footer class="q-bar">
        <button class="q-undo ctrl" data-action="undo" title="Undo last score change (U)">${ICONS.undo}</button>
      </footer>
    </div>`;
  screen.appendChild(el);

  // Team cards with ✓ (give points) and ✗ (take points).
  const scoreboard = new Scoreboard(el.querySelector('.q-bar'), {
    actions: { onPlus: i => score(i, +1), onMinus: i => score(i, -1) },
  });
  el.querySelector('.q-bar').prepend(scoreboard.el);
  scoreboard.setPoints(points);
  scoreboard.render(game.teams, null, { animate: false });

  function score(team, sign) {
    if (team >= game.teams.length) return;
    changeScore(game, team, sign * points);
    scoreboard.render(game.teams, null);
    if (sign > 0) reveal(); // a correct answer: show it to the class
  }

  function undo() {
    const last = undoScore(game);
    if (!last) return toast(`${ICONS.undo} Nothing to undo`);
    scoreboard.render(game.teams, null);
    toast(`${ICONS.undo} Undone: ${esc(game.teams[last.team].name)} ${formatChange(last.delta)}`);
  }

  function reveal() {
    if (game.open.revealed) return;
    game.open.revealed = true;
    saveGame(game);
    showAnswer(true);
  }

  function showAnswer(animate) {
    el.querySelector('.q-reveal').hidden = true;
    const answer = el.querySelector('.q-answer');
    answer.hidden = false;
    if (animate && !REDUCED_MOTION) answer.classList.add('pop');
    fitAll();
  }

  function fitAll() {
    document.fonts.ready.then(() => {
      const text = el.querySelector('.q-text');
      if (text) fitBlock(text, 14);
      const main = el.querySelector('.q-answer-text');
      if (main && !main.closest('[hidden]')) fitBlock(main, 14);
    });
  }

  // ---------- Opening animation: the tile flips, then grows to fill the screen ----------
  async function animateOpen() {
    if (!tileEl || REDUCED_MOTION) return;
    const from = tileEl.getBoundingClientRect();
    el.classList.add('opening');
    tileEl.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }], { duration: 180, easing: 'ease-in' });
    await wait(170);
    await el.animate([
      { transform: rectTransform(from), borderRadius: '2%' },
      { transform: 'none', borderRadius: '0' },
    ], { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' }).finished;
    el.classList.remove('opening');
  }

  async function animateClose() {
    if (!tileEl || REDUCED_MOTION || !tileEl.isConnected) return;
    const to = tileEl.getBoundingClientRect();
    el.classList.add('opening');
    await el.animate([
      { transform: 'none', opacity: 1 },
      { transform: rectTransform(to), opacity: .6 },
    ], { duration: 320, easing: 'cubic-bezier(.6, 0, .8, .4)', fill: 'forwards' }).finished;
  }

  // ---------- Closing ----------
  let closing = false;
  async function close(result) {
    if (closing) return;
    closing = true;
    popKeys();
    onClose(result, async () => {
      await animateClose();
      el.remove();
    });
  }

  // ---------- Clicks and keys ----------
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'reveal') reveal();
    else if (action === 'close') close('done');
    else if (action === 'putback') close('putback');
    else if (action === 'undo') undo();
  });

  const popKeys = pushKeys(e => {
    const team = teamKey(e);
    if (team >= 0) { score(team, e.shiftKey ? -1 : +1); return true; }
    switch (e.key.toLowerCase()) {
      case 'a': reveal(); return true;
      case 'u': undo(); return true;
      case 'escape': close('done'); return true;
      case 'backspace': close('putback'); return true;
    }
    return false;
  });

  if (game.open.revealed) showAnswer(false);
  el.querySelectorAll('img').forEach(img => img.addEventListener('load', fitAll));
  fitAll();
  animateOpen().then(fitAll);
}

// A transform that shrinks the full screen down onto a rectangle (a tile).
function rectTransform(rect) {
  const sx = rect.width / innerWidth;
  const sy = rect.height / innerHeight;
  return `translate(${rect.left}px, ${rect.top}px) scale(${sx}, ${sy})`;
}

const wait = ms => new Promise(res => setTimeout(res, ms));
