// Small helpers for building screens. Reusable by any classroom game.

// Make text safe to put inside HTML (team names, questions from board files).
export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Shrink an element's font size until its text fits on one line.
export function fitText(el, minPx = 8) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > minPx) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
}

// Shrink an element's font size until its text fits inside its box (several lines allowed).
export function fitBlock(el, minPx = 8) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while ((el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) && size > minPx) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
}
