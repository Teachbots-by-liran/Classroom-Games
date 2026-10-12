// A help overlay listing the host's keyboard shortcuts. Reusable by any classroom game.
//
//   toggleHelp([{ title: 'Question', keys: [['A', 'Show the answer'], ...] }, ...])
//
// Press ? or Esc (or click anywhere) to close it.

import { esc } from './dom.js';
import { pushKeys } from './keys.js';

let open = null;

export function toggleHelp(sections) {
  if (open) return open();

  const el = document.createElement('div');
  el.className = 'help-backdrop';
  el.innerHTML = `
    <div class="help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <h2>Keys</h2>
      <div class="help-cols">
        ${sections.map(s => `
          <section>
            <h3>${esc(s.title)}</h3>
            <dl>${s.keys.map(([key, label]) => `
              <div><dt>${key.split(' / ').map(k => `<kbd>${esc(k)}</kbd>`).join('<span>/</span>')}</dt><dd>${esc(label)}</dd></div>`).join('')}
            </dl>
          </section>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(el);

  const popKeys = pushKeys(e => {
    if (e.key === '?' || e.key === 'Escape') close();
    return true; // the game ignores keys while help is open
  });
  function close() {
    popKeys();
    el.remove();
    open = null;
  }
  el.addEventListener('click', close);
  open = close;
}
