// The Daily Double: a big reveal, then the team whose turn it is places a bet.
//
// Bet rule (classroom rules): from 0 up to the team's score, or up to the board's highest tile
// value (usually 500) if their score is lower — so a team at zero or below can still bet.
//
// Keys: type numbers to set the bet · ↑ / ↓ = ±100 · Enter = lock the bet in
//       T = another team bets · Esc = put the tile back unplayed

import { esc, fitText } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys } from '../shared/keys.js';
import { formatScore } from '../shared/scoreboard.js';
import { teamBadge, teamLook } from '../shared/team-looks.js';
import { sound } from '../shared/sound.js';
import { saveGame } from './game-state.js';
import { rectTransform } from './question-screen.js';

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP = 100;

export function highestTile(board) {
  return Math.max(...board.categories.flatMap(c => c.questions.map(q => q.points)));
}

export function maxBet(game, team) {
  return Math.max(game.teams[team].score, highestTile(game.board));
}

// options: { tileEl (to grow from; null after a refresh = no reveal animation), onLocked(), onCancel() }
export function showDailyDouble(screen, game, { tileEl = null, onLocked, onCancel }) {
  const { c, r } = game.open;
  const q = game.board.categories[c].questions[r];
  const dd = game.open.dd;
  const fresh = !!tileEl;

  const el = document.createElement('div');
  el.className = 'dd' + (fresh && !REDUCED_MOTION ? '' : ' wagering no-intro');
  el.innerHTML = `
    <div class="dd-lights" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="dd-burst" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i style="--a:${i * 22.5}deg"></i>`).join('')}</div>
    <button class="q-btn dd-cancel" data-action="cancel" title="Put the tile back unplayed (Esc)">${ICONS.undo}</button>
    <h1 class="dd-title"><span>Daily</span><span>Double!</span></h1>
    <div class="dd-wager">
      <div class="dd-teams"></div>
      <div class="dd-bet">
        <button class="dd-step" data-step="-1" aria-label="Bet ${STEP} less">−${STEP}</button>
        <div class="dd-amount">
          <output class="dd-value"></output>
          <div class="dd-max"></div>
        </div>
        <button class="dd-step" data-step="1" aria-label="Bet ${STEP} more">+${STEP}</button>
      </div>
      <div class="dd-buttons">
        <button class="dd-allin" data-action="allin">${ICONS.flag}All in</button>
        <button class="start-btn dd-lock" data-action="lock">BET ${ICONS.play}</button>
      </div>
    </div>`;
  screen.appendChild(el);

  const teamsEl = el.querySelector('.dd-teams');
  const valueEl = el.querySelector('.dd-value');
  const maxEl = el.querySelector('.dd-max');
  let typing = false; // the first digit typed replaces the bet, the next ones add to it

  function render() {
    const max = maxBet(game, dd.team);
    dd.wager = Math.max(0, Math.min(dd.wager, max));
    teamsEl.innerHTML = game.teams.map((t, i) => `
      <button class="dd-team${i === dd.team ? ' on' : ''}" data-team="${i}" style="--team:${teamLook(i).color}" aria-pressed="${i === dd.team}">
        ${teamBadge(i)}<span class="dd-team-name">${esc(t.name)}</span>
        ${i === dd.team ? `<span class="dd-team-score">${formatScore(t.score)}</span>` : ''}
      </button>`).join('');
    valueEl.textContent = dd.wager.toLocaleString('en-US');
    maxEl.innerHTML = `Max ${max.toLocaleString('en-US')}`;
    el.querySelector('.dd-allin').classList.toggle('on', dd.wager === max);
    document.fonts.ready.then(() => teamsEl.querySelectorAll('.dd-team-name').forEach(n => fitText(n, 10)));
  }

  function setWager(n) {
    dd.wager = n;
    render();
    saveGame(game);
  }

  function step(dir) {
    typing = false;
    // Move to the next round hundred: 350 → 400 going up, 350 → 300 going down.
    const next = dir > 0 ? Math.floor(dd.wager / STEP) * STEP + STEP : Math.ceil(dd.wager / STEP) * STEP - STEP;
    setWager(next);
    sound.play('tick');
  }

  function typeDigit(d) {
    const next = typing ? Number(String(dd.wager) + d) : Number(d);
    typing = true;
    setWager(Math.min(next, maxBet(game, dd.team)));
  }

  function chooseTeam(i) {
    if (i < 0 || i >= game.teams.length) return;
    dd.team = i;
    typing = false;
    sound.play('turn');
    setWager(Math.min(dd.wager, maxBet(game, i)));
  }

  async function lock() {
    dd.locked = true;
    saveGame(game);
    popKeys();
    sound.play('reveal');
    onLocked();
    // The question is now open underneath: fade this screen away to show it.
    if (!REDUCED_MOTION) await el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 450, easing: 'ease-in' }).finished;
    el.remove();
  }

  async function cancel() {
    popKeys();
    sound.play('close');
    const tile = tileEl?.isConnected ? tileEl : null;
    if (tile && !REDUCED_MOTION) {
      await el.animate([{ transform: 'none', opacity: 1 }, { transform: rectTransform(tile.getBoundingClientRect()), opacity: .6 }],
        { duration: 320, easing: 'cubic-bezier(.6, 0, .8, .4)', fill: 'forwards' }).finished;
    }
    el.remove();
    onCancel();
  }

  el.addEventListener('click', e => {
    const team = e.target.closest('.dd-team');
    if (team) return chooseTeam(Number(team.dataset.team));
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) return step(Number(stepBtn.dataset.step));
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'allin') { typing = false; setWager(maxBet(game, dd.team)); sound.play('turn'); }
    if (btn.dataset.action === 'lock') lock();
    if (btn.dataset.action === 'cancel') cancel();
  });

  // While betting, number keys type the bet (they don't pick teams).
  const popKeys = pushKeys(e => {
    if (!el.classList.contains('wagering')) return e.key !== '?'; // wait for the reveal to finish
    if (/^[0-9]$/.test(e.key)) { typeDigit(e.key); return true; }
    switch (e.key) {
      case 'ArrowUp': case 'ArrowRight': case '+': step(1); return true;
      case 'ArrowDown': case 'ArrowLeft': case '-': step(-1); return true;
      case 'Backspace': typing = true; setWager(Math.floor(dd.wager / 10)); return true;
      case 'Enter': lock(); return true;
      case 'Escape': cancel(); return true;
      case 't': case 'T': chooseTeam((dd.team + 1) % game.teams.length); return true;
    }
    return e.code === 'Space'; // no timer while betting
  });

  render();

  // ---------- The reveal: grow from the tile, spotlights, title slam, then the bet panel ----------
  if (fresh && !REDUCED_MOTION) {
    sound.play('sting');
    const from = tileEl.getBoundingClientRect();
    el.animate([
      { transform: rectTransform(from), borderRadius: '2%' },
      { transform: 'none', borderRadius: '0' },
    ], { duration: 450, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    setTimeout(() => el.classList.add('wagering'), 2300);
  }
}
