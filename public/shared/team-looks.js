// How each team looks: a shape, a color, and its number key.
// Shapes matter more than colors: projectors wash colors out, and not everyone sees color the same way.
// Reusable by any classroom game.

export const MAX_TEAMS = 6;

export const TEAM_LOOKS = [
  { shape: 'triangle', color: '#FFB300' },
  { shape: 'circle',   color: '#4FC3F7' },
  { shape: 'square',   color: '#F06292' },
  { shape: 'diamond',  color: '#B2FF59' },
  { shape: 'star',     color: '#FF8A50' },
  { shape: 'hexagon',  color: '#E0E0FF' },
];

const SHAPE_PATHS = {
  triangle: '<path d="M12 2.5 L22.5 21 H1.5 Z"/>',
  circle:   '<circle cx="12" cy="12" r="10"/>',
  square:   '<rect x="2.5" y="2.5" width="19" height="19" rx="1.5"/>',
  diamond:  '<path d="M12 1 L23 12 L12 23 L1 12 Z"/>',
  star:     '<path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14 1.7 9l7.2-.9z"/>',
  hexagon:  '<path d="M12 1.5 21.5 7v10L12 22.5 2.5 17V7z"/>',
};

export function teamLook(index) {
  return TEAM_LOOKS[index % TEAM_LOOKS.length];
}

// A team badge: the team's shape with its number key inside.
export function teamBadge(index) {
  const look = teamLook(index);
  return `<span class="team-badge" style="--team:${look.color}">` +
    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SHAPE_PATHS[look.shape]}</svg>` +
    `<b>${index + 1}</b></span>`;
}
