// A simple place to keep things inside this browser (IndexedDB), with room for pictures.
// Reusable by any classroom game. Everything stays on this computer, in this browser only.
//
//   const store = browserStore('jeopardy-boards');   // any name; each name is its own shelf
//   await store.set(key, value); await store.get(key); await store.all(); await store.remove(key);

const DB_NAME = 'classroom-games';
const SHELF = 'items'; // one table; keys are "<store name>/<key>"
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(SHELF);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(mode, action) {
  return db().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(SHELF, mode);
    const req = action(tx.objectStore(SHELF));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('The browser could not save. Its storage may be full.'));
  }));
}

export function browserStore(name) {
  const prefix = name + '/';
  const range = IDBKeyRange.bound(prefix, prefix + '￿');
  return {
    get: key => run('readonly', s => s.get(prefix + key)),
    set: (key, value) => run('readwrite', s => s.put(value, prefix + key)),
    remove: key => run('readwrite', s => s.delete(prefix + key)),
    async all() {
      const keys = await run('readonly', s => s.getAllKeys(range));
      const values = await run('readonly', s => s.getAll(range));
      return keys.map((key, i) => ({ key: key.slice(prefix.length), value: values[i] }));
    },
  };
}
