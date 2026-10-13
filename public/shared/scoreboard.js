// Team scoreboard — reusable by any classroom game.
// Shows each team's badge, name and score, marks whose turn it is, and animates score changes.
// Optional ✓ / ✗ buttons let the host give or take points with one click.
// Needs /shared/scoreboard.css on the page.

import { esc, fitText } from './dom.js';
import { ICONS } from './icons.js';
import { teamBadge, teamLook } from './team-looks.js';

const ARROW_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18L12 20z" fill="currentColor"/></svg>';
const ARROW_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18L12 4z" fill="currentColor"/></svg>';

export function formatScore(n) {
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? '−' + abs : abs; // real minus sign, easier to see than a hyphen
}

export function formatChange(n) {
  return (n < 0 ? '−' : '+') + Math.abs(n).toLocaleString('en-US');
}

export class Scoreboard {
  // options:
  //   turnLabel   – word on the turn tag ("Pick")
  //   onTeamClick – called with the team index when a team card is clicked
  //   actions     – { onPlus(i), onMinus(i) } adds ✓ and ✗ buttons to every card
  constructor(container, { turnLabel = 'Pick', onTeamClick = null, actions = null } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'scoreboard' + (actions ? ' with-actions' : '');
    container.appendChild(this.el);
    this.turnLabel = turnLabel;
    this.actions = actions;
    this.points = 0;
    this.actionTeams = null; // null = every team gets ✓ / ✗ buttons
    this.marks = {};         // team index → 'right' | 'wrong', shown on the card
    this.shown = null; // scores currently on screen, to know what changed

    this.el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (act && this.actions) {
        const i = Number(act.dataset.team);
        if (act.dataset.act === 'plus') this.actions.onPlus(i);
        else this.actions.onMinus(i);
        return;
      }
      const card = e.target.closest('.sb-team');
      if (card && onTeamClick) onTeamClick(Number(card.dataset.team));
    });
  }

  // The points shown on the ✓ / ✗ buttons.
  setPoints(points) {
    this.points = points;
  }

  // Only these teams (indexes) get ✓ / ✗ buttons; the others are dimmed. null = all teams.
  // Show which teams are already marked right or wrong (e.g. Final Round). Points = null hides amounts.
  setMarks(marks) {
    this.marks = marks || {};
  }

  setActionTeams(list) {
    this.actionTeams = list;
  }

  render(teams, turn = null, { animate = true } = {}) {
    const before = this.shown;
    this.shown = teams.map(t => t.score);

    this.el.innerHTML = teams.map((t, i) => `
      <div class="sb-team${i === turn ? ' turn' : ''}${t.score < 0 ? ' neg' : ''}${this.isIdle(i) ? ' idle' : ''}${this.marks[i] ? ' mark-' + this.marks[i] : ''}" style="--team:${teamLook(i).color}" data-team="${i}">
        ${i === turn ? `<div class="sb-turn-tag">${ARROW_DOWN}<span>${esc(this.turnLabel)}</span></div>` : ''}
        <div class="sb-row">${teamBadge(i)}<div class="sb-name">${esc(t.name)}</div></div>
        <div class="sb-score">${formatScore(t.score)}</div>
        ${this.marks[i] ? `<div class="sb-mark">${this.marks[i] === 'right' ? ICONS.check : ICONS.close}</div>` : ''}
        ${this.actions && !this.isIdle(i) ? `
          <div class="sb-actions">
            <button class="sb-act plus" data-act="plus" data-team="${i}" aria-pressed="${this.marks[i] === 'right'}" title="Correct (key ${i + 1})">${ICONS.check}${this.points === null ? '' : `<span>${formatChange(this.points)}</span>`}</button>
            <button class="sb-act minus" data-act="minus" data-team="${i}" aria-pressed="${this.marks[i] === 'wrong'}" title="Wrong (Shift + ${i + 1})">${ICONS.close}${this.points === null ? '' : `<span>${formatChange(-this.points)}</span>`}</button>
          </div>` : ''}
      </div>`).join('');

    document.fonts.ready.then(() => this.el.querySelectorAll('.sb-name').forEach(n => fitText(n)));

    if (animate && before && before.length === teams.length) {
      teams.forEach((t, i) => {
        if (before[i] !== t.score) this.animateChange(i, before[i], t.score);
      });
    }
  }

  isIdle(i) {
    return !!this.actionTeams && !this.actionTeams.includes(i);
  }

  // Roll the number to its new value, bump the card, and float a "+300" / "−300" badge above it.
  animateChange(i, from, to) {
    const card = this.el.querySelector(`.sb-team[data-team="${i}"]`);
    if (!card) return;
    const scoreEl = card.querySelector('.sb-score');
    const up = to > from;

    card.classList.remove('bump-up', 'bump-down');
    void card.offsetWidth; // restart the animation
    card.classList.add(up ? 'bump-up' : 'bump-down');

    const chip = document.createElement('div');
    chip.className = 'sb-chip ' + (up ? 'up' : 'down');
    chip.innerHTML = (up ? ARROW_UP : ARROW_DOWN) + `<span>${formatChange(to - from)}</span>`;
    card.appendChild(chip);
    chip.addEventListener('animationend', () => chip.remove());

    const start = performance.now();
    const duration = 700;
    const step = now => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      scoreEl.textContent = formatScore(Math.round(from + (to - from) * eased));
      if (p < 1 && scoreEl.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
