// Keyboard shortcuts for the host. Reusable by any classroom game.
// Screens add a handler with pushKeys(); the newest handler (e.g. an open question) gets each key first.
// A handler returns true when it used the key; otherwise the key passes to the screen underneath.

const stack = [];

document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i](e)) {
      e.preventDefault();
      return;
    }
  }
});

export function pushKeys(handler) {
  stack.push(handler);
  return () => {
    const i = stack.indexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

// Which team number key was pressed (1-6 on the top row or the number pad)? Returns a 0-based index or -1.
export function teamKey(e) {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  return m ? Number(m[1]) - 1 : -1;
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
