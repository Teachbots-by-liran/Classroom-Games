// Team scoreboard — reusable by any classroom game.
// Shows each team's badge, name and score, and marks whose turn it is.
// Needs /shared/scoreboard.css on the page.

import { esc, fitText } from './dom.js';
import { teamBadge, teamLook } from './team-looks.js';

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18L12 20z" fill="currentColor"/></svg>';

export function formatScore(n) {
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? '−' + abs : abs; // real minus sign, easier to see than a hyphen
}

export class Scoreboard {
  // teams: [{ name, score }], turn: index of the team whose turn it is (or null)
  constructor(container, { turnLabel = 'Pick' } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'scoreboard';
    container.appendChild(this.el);
    this.turnLabel = turnLabel;
  }

  render(teams, turn = null) {
    this.el.innerHTML = teams.map((t, i) => `
      <div class="sb-team${i === turn ? ' turn' : ''}${t.score < 0 ? ' neg' : ''}" style="--team:${teamLook(i).color}" data-team="${i}">
        ${i === turn ? `<div class="sb-turn-tag">${ARROW}<span>${esc(this.turnLabel)}</span></div>` : ''}
        <div class="sb-row">${teamBadge(i)}<div class="sb-name">${esc(t.name)}</div></div>
        <div class="sb-score">${formatScore(t.score)}</div>
      </div>`).join('');
    document.fonts.ready.then(() => this.el.querySelectorAll('.sb-name').forEach(n => fitText(n)));
  }
}
