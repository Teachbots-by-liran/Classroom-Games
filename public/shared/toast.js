// A short message that pops up at the top of the screen and disappears. Reusable by any classroom game.

let current = null;

export function toast(html, ms = 2200) {
  current?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = html;
  document.body.appendChild(el);
  current = el;
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
