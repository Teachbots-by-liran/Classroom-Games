// The full-screen question: the tile flips and grows to fill the screen,
// the host reveals the answer and gives or takes points from any team.
//
// Multiple choice: click the choice a team calls out. A wrong one is crossed out, the right one lights up.
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
  const mc = Array.isArray(q.choices) && q.choices.length > 0;
  if (mc && !Array.isArray(game.open.out)) game.open.out = []; // choices crossed out so far

  const el = document.createElement('div');
  el.className = 'question';
  el.innerHTML = `
    <div class="q-inner">
      <header class="q-head">
        <button class="q-btn" data-action="putback" title="Put back: close without using this tile (Backspace)">${ICONS.undo}</button>
        <div class="q-title"><span class="q-cat">${esc(cat.name)}</span><span class="q-pts">${points}</span></div>
        <button class="q-btn" data-action="close" title="Done (Esc)">${ICONS.close}</button>
      </header>
      <div class="q-body${q.image ? ' has-image' : ''}${mc ? ' has-choices' : ''}">
        ${q.image ? `<div class="q-image"><img src="${esc(q.image)}" alt=""></div>` : ''}
        <div class="q-side">
          <div class="q-text">
            ${q.quote ? `<blockquote class="q-quote" dir="auto">${esc(q.quote)}</blockquote>` : ''}
            ${q.question ? `<p class="q-question" dir="auto">${esc(q.question)}</p>` : ''}
          </div>
          ${mc ? choicesHtml(q) : ''}
          <div class="q-answer-slot">
            <button class="q-reveal" data-action="reveal">${ICONS.eye}<span>Answer</span><kbd>A</kbd></button>
            ${mc ? explainHtml(q) : answerHtml(q)}
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
    if (answer) {
      answer.hidden = false;
      if (animate && !REDUCED_MOTION) answer.classList.add('pop');
    } else {
      el.querySelector('.q-answer-slot').classList.add('empty');
    }
    if (mc) {
      el.querySelector('.q-choices').classList.add('revealed');
      const right = el.querySelector(`.q-choice[data-choice="${q.correct}"]`);
      right.classList.remove('out');
      right.classList.add('correct');
      right.querySelector('.q-mark').innerHTML = ICONS.check;
      if (animate && !REDUCED_MOTION) right.classList.add('pop');
    }
    fitAll();
  }

  // A team called out a choice: cross it out if wrong, reveal if right.
  // Clicking a crossed-out choice again brings it back (for misclicks).
  function pickChoice(i) {
    if (!mc || i >= q.choices.length) return;
    if (i === q.correct) return reveal();
    if (game.open.revealed) return;
    const out = game.open.out;
    const at = out.indexOf(i);
    if (at >= 0) out.splice(at, 1);
    else out.push(i);
    saveGame(game);
    showOut(i, at < 0);
  }

  function showOut(i, isOut, animate = true) {
    const btn = el.querySelector(`.q-choice[data-choice="${i}"]`);
    btn.classList.toggle('out', isOut);
    btn.querySelector('.q-mark').innerHTML = isOut ? ICONS.close : '';
    if (isOut && animate && !REDUCED_MOTION) {
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
    }
  }

  function fitAll() {
    document.fonts.ready.then(() => {
      const text = el.querySelector('.q-text');
      if (text) fitBlock(text, 14);
      el.querySelectorAll('.q-choice-text').forEach(t => fitBlock(t, 12));
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
    else if (action === 'choice') pickChoice(Number(btn.dataset.choice));
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

  if (mc) game.open.out.forEach(i => showOut(i, true, false));
  if (game.open.revealed) showAnswer(false);
  el.querySelectorAll('img').forEach(img => img.addEventListener('load', fitAll));
  fitAll();
  animateOpen().then(fitAll);
}

function answerHtml(q) {
  return `
    <div class="q-answer" hidden>
      ${q.answerImage ? `<img class="q-answer-img" src="${esc(q.answerImage)}" alt="">` : ''}
      <div class="q-answer-text">
        <div class="q-answer-main" dir="auto">${ICONS.check}<span>${esc(q.answer)}</span></div>
        ${q.explain ? `<div class="q-explain" dir="auto">${esc(q.explain)}</div>` : ''}
      </div>
    </div>`;
}

// Multiple choice shows the answer on the choices themselves, so only the explanation (if any) goes here.
function explainHtml(q) {
  if (!q.explain) return '';
  return `<div class="q-answer compact" hidden><div class="q-answer-text"><div class="q-explain" dir="auto">${esc(q.explain)}</div></div></div>`;
}

function choicesHtml(q) {
  return `<div class="q-choices" style="--rows:${Math.ceil(q.choices.length / 2)}">` +
    q.choices.map((choice, i) => `
      <button class="q-choice" data-action="choice" data-choice="${i}" title="Click when a team chooses this">
        <span class="q-letter">${'ABCDEF'[i]}</span>
        <span class="q-choice-text" dir="auto"><span>${esc(choice)}</span></span>
        <span class="q-mark"></span>
      </button>`).join('') + '</div>';
}

// A transform that shrinks the full screen down onto a rectangle (a tile).
function rectTransform(rect) {
  const sx = rect.width / innerWidth;
  const sy = rect.height / innerHeight;
  return `translate(${rect.left}px, ${rect.top}px) scale(${sx}, ${sy})`;
}

const wait = ms => new Promise(res => setTimeout(res, ms));
