// The main game screen: the board of tiles and the scoreboard underneath.
// (Step 1: drawing only. Opening questions and scoring come in step 2.)

import { esc, fitBlock } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { Scoreboard } from '../shared/scoreboard.js';

export function showBoard(app, game) {
  const { board } = game;
  const rows = Math.max(...board.categories.map(c => c.questions.length));

  app.innerHTML = `
    <div class="screen game">
      <section class="board" style="--cols:${board.categories.length}; --rows:${rows}"></section>
      <footer class="bar">
        <div class="controls">
          <div class="ctrl ctrl-timer">${ICONS.timer}<span class="timer-num">${game.timerSeconds}</span></div>
          <div class="ctrl-col">
            <button class="ctrl ctrl-small" title="Sound on/off (M)">${ICONS.sound}</button>
            <button class="ctrl ctrl-small" title="Help (?)">${ICONS.help}</button>
          </div>
        </div>
      </footer>
    </div>`;

  // Categories across the top, then one row per point value.
  let html = board.categories.map(c => `<div class="cat"><span>${esc(c.name)}</span></div>`).join('');
  for (let r = 0; r < rows; r++) {
    board.categories.forEach((cat, c) => {
      const q = cat.questions[r];
      html += q
        ? `<button class="tile" data-cat="${c}" data-row="${r}"><span class="pts">${q.points}</span></button>`
        : `<div class="tile empty"></div>`;
    });
  }
  const boardEl = app.querySelector('.board');
  boardEl.innerHTML = html;
  document.fonts.ready.then(() => boardEl.querySelectorAll('.cat').forEach(fitBlock));

  const bar = app.querySelector('.bar');
  const scoreboard = new Scoreboard(bar);
  bar.prepend(scoreboard.el);
  scoreboard.render(game.teams, game.turn);
}
