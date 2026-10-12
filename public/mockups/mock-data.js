// Shared fake data for the three board-screen mockups.
// Each mockup page calls renderMock() and only changes the styling.

window.MOCK = {
  categories: ['Idioms in Pictures', 'Famous Quotes', 'Irregular Verbs', 'British vs American', "What's This Word?"],
  values: [100, 200, 300, 400, 500],
  // "column-row" of tiles that have already been played
  used: ['0-0', '1-0', '1-1', '2-2', '3-0', '4-1', '4-3'],
  teams: [
    { name: 'Lions',   score: 600,  shape: 'triangle', color: '#FFB300' },
    { name: 'Rockets', score: 1200, shape: 'circle',   color: '#4FC3F7', turn: true },
    { name: 'Sharks',  score: -200, shape: 'square',   color: '#F06292' },
    { name: 'Comets',  score: 300,  shape: 'diamond',  color: '#B2FF59' },
    { name: 'Tigers',  score: 1800, shape: 'star',     color: '#FF8A50' },
    { name: 'Wolves',  score: 0,    shape: 'hexagon',  color: '#E0E0FF' },
  ],
};

window.SHAPES = {
  triangle: '<path d="M12 2.5 L22.5 21 H1.5 Z"/>',
  circle:   '<circle cx="12" cy="12" r="10"/>',
  square:   '<rect x="2.5" y="2.5" width="19" height="19" rx="1.5"/>',
  diamond:  '<path d="M12 1 L23 12 L12 23 L1 12 Z"/>',
  star:     '<path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14 1.7 9l7.2-.9z"/>',
  hexagon:  '<path d="M12 1.5 21.5 7v10L12 22.5 2.5 17V7z"/>',
};

window.ICONS = {
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4.5l3 2M9.5 2.5h5"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13"/></svg>',
  help:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5"/><circle cx="12" cy="19" r=".6" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M3 6h18L12 20z" fill="currentColor"/></svg>',
};

function shapeSvg(name) {
  return '<svg viewBox="0 0 24 24" fill="currentColor">' + SHAPES[name] + '</svg>';
}

function formatScore(n) {
  return n < 0 ? '−' + Math.abs(n).toLocaleString('en-US') : n.toLocaleString('en-US');
}

function renderMock() {
  const d = MOCK;
  const board = document.querySelector('.board');
  let html = d.categories.map(c => '<div class="cat"><span>' + c + '</span></div>').join('');
  d.values.forEach((v, row) => {
    d.categories.forEach((_, col) => {
      const used = d.used.includes(col + '-' + row);
      html += used
        ? '<div class="tile used" aria-label="played"></div>'
        : '<button class="tile"><span class="pts">' + v + '</span></button>';
    });
  });
  board.innerHTML = html;

  document.querySelector('.teams').innerHTML = d.teams.map((t, i) =>
    '<div class="team' + (t.turn ? ' turn' : '') + (t.score < 0 ? ' neg' : '') + '" style="--team:' + t.color + '">' +
      (t.turn ? '<div class="turn-tag">' + ICONS.arrow + '<span>Pick</span></div>' : '') +
      '<div class="trow"><div class="badge">' + shapeSvg(t.shape) + '<b>' + (i + 1) + '</b></div>' +
      '<div class="tname">' + t.name + '</div></div>' +
      '<div class="tscore">' + formatScore(t.score) + '</div>' +
    '</div>').join('');

  document.querySelector('.controls').innerHTML =
    '<div class="timer">' + ICONS.timer + '<span>30</span></div>' +
    '<div class="icons"><button class="icon" title="Mute">' + ICONS.sound + '</button>' +
    '<button class="icon" title="Help">' + ICONS.help + '</button></div>';
}

// Shrink text until it fits its box (long team names).
function fitText(el) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > 8) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderMock();
  document.fonts.ready.then(() => document.querySelectorAll('.tname').forEach(fitText));
});
