// Boards saved inside this browser — used when the game runs online, where the server can't save files.
// Their names start with "browser:" so the game knows where to find them.

import { browserStore } from '../shared/browser-store.js';

const store = browserStore('jeopardy-boards');
export const BROWSER_PREFIX = 'browser:';

export const isBrowserBoard = file => typeof file === 'string' && file.startsWith(BROWSER_PREFIX);

// Can this copy of the game save files into the boards folder? (Yes on the laptop, no online.)
let canSavePromise = null;
export function serverCanSave() {
  if (!canSavePromise) {
    canSavePromise = fetch('/api/jeopardy/can-save')
      .then(r => (r.ok ? r.json() : { canSave: false }))
      .then(d => !!d.canSave)
      .catch(() => false);
  }
  return canSavePromise;
}

export async function listBrowserBoards() {
  try {
    const items = await store.all();
    return items.map(({ key, value }) => ({
      file: key,
      title: value.title || 'Untitled board',
      categories: (value.categories || []).map(c => c.name),
      inBrowser: true,
    }));
  } catch {
    return [];
  }
}

export function getBrowserBoard(file) {
  return store.get(file);
}

// Save a board; a new board gets a name from its title. Returns the name.
export async function saveBrowserBoard(file, raw) {
  let name = file;
  if (!name) {
    const base = BROWSER_PREFIX + (String(raw.title || 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board');
    const taken = new Set((await store.all()).map(i => i.key));
    name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
  }
  await store.set(name, raw);
  return name;
}

export function deleteBrowserBoard(file) {
  return store.remove(file);
}

// Turn a picture file into a picture stored inside the board: big photos are made smaller first,
// so the board stays light. SVG drawings are kept as they are.
export async function pictureToData(fileObj, maxSize = 1280) {
  if (fileObj.type === 'image/svg+xml') return readAsDataUrl(fileObj);
  const url = URL.createObjectURL(fileObj);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This picture could not be opened.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // pictures are shown on white, so transparent parts stay white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readAsDataUrl(fileObj) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(fileObj);
  });
}
