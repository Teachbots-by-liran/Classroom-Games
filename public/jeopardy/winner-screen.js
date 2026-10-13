// The winner celebration: trophy, the winning team (or teams, if tied), the other places, confetti and a fanfare.

import { esc, fitText } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys, toggleFullscreen } from '../shared/keys.js';
import { formatScore } from '../shared/scoreboard.js';
import { teamBadge, teamLook, TEAM_LOOKS } from '../shared/team-looks.js';
import { confetti } from '../shared/confetti.js';
import { sound } from '../shared/sound.js';
import { confirmDialog } from '../shared/dialog.js';
import { ranking } from './game-state.js';
import { toggleSound } from './host-tools.js';

const PLACE = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

const TROPHY = `
<svg class="trophy" viewBox="0 0 200 220" aria-hidden="true">
  <defs>
    <linearGradient id="gold" x1="0" x2="1">
      <stop offset="0" stop-color="#c98a00"/><stop offset=".35" stop-color="#ffe9a0"/>
      <stop offset=".6" stop-color="#ffd24a"/><stop offset="1" stop-color="#a86f00"/>
    </linearGradient>
  </defs>
  <path d="M52 30 H18 a8 8 0 0 0 -8 8 c0 34 22 56 50 60" fill="none" stroke="url(#gold)" stroke-width="12"/>
  <path d="M148 30 H182 a8 8 0 0 1 8 8 c0 34 -22 56 -50 60" fill="none" stroke="url(#gold)" stroke-width="12"/>
  <path d="M45 14 H155 V60 c0 40 -24 70 -55 74 c-31 -4 -55 -34 -55 -74 Z" fill="url(#gold)" stroke="#5a3b00" stroke-width="4"/>
  <path d="M62 26 v32 c0 18 6 32 16 42" fill="none" stroke="#fff8d6" stroke-width="7" stroke-linecap="round" opacity=".8"/>
  <path d="M88 134 h24 l6 34 h-36 Z" fill="url(#gold)" stroke="#5a3b00" stroke-width="4"/>
  <rect x="56" y="168" width="88" height="20" rx="4" fill="url(#gold)" stroke="#5a3b00" stroke-width="4"/>
  <rect x="44" y="188" width="112" height="24" rx="5" fill="#3a2a00" stroke="#5a3b00" stroke-width="4"/>
  <path d="M100 42 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2z" fill="#fff8d6"/>
</svg>`;

export function showWinnerScreen(app, game, { onNewGame }) {
  const ranked = ranking(game);
  const winners = ranked.filter(t => t.place === 1);
  const others = ranked.filter(t => t.place > 1);

  app.innerHTML = `
    <div class="screen winners">
      <div class="dd-lights" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="win-main">
        ${TROPHY}
        <h1 class="win-title">${winners.length > 1 ? 'Winners!' : 'Winner!'}</h1>
        <div class="win-teams">
          ${winners.map(t => `
            <div class="win-card" style="--team:${teamLook(t.index).color}">
              ${teamBadge(t.index)}
              <span class="win-name">${esc(t.name)}</span>
              <span class="win-score">${formatScore(t.score)}</span>
            </div>`).join('')}
        </div>
      </div>
      ${others.length ? `
        <ol class="win-rest" style="--n:${others.length}">
          ${others.map(t => `
            <li class="win-row" style="--team:${teamLook(t.index).color}">
              <span class="win-place">${PLACE(t.place)}</span>
              ${teamBadge(t.index)}
              <span class="win-row-name">${esc(t.name)}</span>
              <span class="win-row-score">${formatScore(t.score)}</span>
            </li>`).join('')}
        </ol>` : ''}
      <button class="ghost-btn win-new" data-action="new">${ICONS.plus} New game</button>
    </div>`;

  const root = app.querySelector('.winners');
  document.fonts.ready.then(() => {
    root.querySelectorAll('.win-name').forEach(n => fitText(n, 20));
    root.querySelectorAll('.win-row-name').forEach(n => fitText(n, 12));
  });

  const stopConfetti = confetti(root, { burst: 160, trickle: 1, colors: ['#FFD24A', '#ffffff', '#ffe9a0', ...winners.map(t => TEAM_LOOKS[t.index % TEAM_LOOKS.length].color)] });
  sound.play('fanfare');

  async function newGame() {
    const sure = await confirmDialog({ title: 'Start a new game?', ok: 'New game', cancel: 'Stay here' });
    if (!sure) return;
    popKeys();
    stopConfetti();
    onNewGame();
  }

  root.addEventListener('click', e => {
    if (e.target.closest('[data-action="new"]')) newGame();
  });
  const popKeys = pushKeys(e => {
    switch (e.key.toLowerCase()) {
      case 'm': toggleSound(); return true;
      case 'f': toggleFullscreen(); return true;
    }
    return false;
  });
}
