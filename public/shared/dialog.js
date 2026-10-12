// A simple "Are you sure?" box. Reusable by any classroom game.
// Returns a promise: true if the host chose OK, false otherwise. Enter = OK, Esc = cancel.

import { esc } from './dom.js';
import { pushKeys } from './keys.js';

export function confirmDialog({ title, text = '', ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'dialog-backdrop';
    el.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true">
        <h2>${esc(title)}</h2>
        ${text ? `<p>${esc(text)}</p>` : ''}
        <div class="dialog-buttons">
          <button class="dialog-btn" data-answer="no">${esc(cancel)}</button>
          <button class="dialog-btn primary${danger ? ' danger' : ''}" data-answer="yes">${esc(ok)}</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('[data-answer="yes"]').focus();

    const popKeys = pushKeys(e => {
      if (e.key === 'Escape') { done(false); return true; }
      if (e.key === 'Enter') { done(true); return true; }
      return true; // nothing else reaches the game while the box is open
    });
    function done(answer) {
      popKeys();
      el.remove();
      resolve(answer);
    }
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-answer]');
      if (btn) done(btn.dataset.answer === 'yes');
      else if (e.target === el) done(false);
    });
  });
}
