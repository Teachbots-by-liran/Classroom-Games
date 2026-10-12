// Keeps a game's state in the browser so an accidental refresh loses nothing.
// Reusable by any classroom game: give each game its own key.

export function createSavedState(key) {
  return {
    load() {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    save(value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage can be full or blocked; the game still works, it just won't survive a refresh.
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}
