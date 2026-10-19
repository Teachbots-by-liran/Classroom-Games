const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.use(express.static(path.join(__dirname, 'public'), { index: false, redirect: false }));

// Jeopardy board files (JSON + pictures) live in /boards, separate from the game code.
const BOARDS_DIR = path.join(__dirname, 'boards');
app.use('/boards', express.static(BOARDS_DIR, { index: false }));

// List every board file so the game can show a menu. A broken file is listed with its error.
app.get('/api/jeopardy/boards', (req, res) => {
  const files = fs.readdirSync(BOARDS_DIR).filter(f => f.toLowerCase().endsWith('.json')).sort();
  res.json(files.map(file => {
    try {
      const board = JSON.parse(fs.readFileSync(path.join(BOARDS_DIR, file), 'utf8'));
      return { file, title: board.title || file, categories: (board.categories || []).map(c => c.name) };
    } catch (err) {
      return { file, title: file, error: err.message };
    }
  }));
});

// ---------- Jeopardy board editor: saving boards and pictures ----------
// Only the laptop running the server may save (not other devices on the school network),
// and files can only be written inside the boards folder.

const IMAGES_DIR = path.join(BOARDS_DIR, 'images');
const PICTURE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };

function onlyThisComputer(req, res, next) {
  const ip = req.socket.remoteAddress || '';
  if (process.env.VERCEL) return res.status(403).json({ error: 'Saving only works when the game runs on your own computer.' });
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  res.status(403).json({ error: 'Boards can only be saved from the computer running the game.' });
}

// Can boards be saved as files here? (Yes on the laptop running the game; no online or from other devices.)
app.get('/api/jeopardy/can-save', (req, res) => {
  const ip = req.socket.remoteAddress || '';
  const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  res.json({ canSave: !process.env.VERCEL && local });
});

// "My Board: Unit 3!" -> "my-board-unit-3"
function slug(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'board';
}

// A file name that is not taken yet: name.json, name-2.json, name-3.json ...
function freeName(dir, base, ext) {
  let name = base + ext;
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${base}-${n}${ext}`;
  return name;
}

// Save a board. Body: { file?: "existing.json", title, board }. A new board gets a file name from its title.
app.post('/api/jeopardy/boards', onlyThisComputer, express.json({ limit: '50mb' }), (req, res) => {
  const { file, board } = req.body || {};
  if (!board || typeof board !== 'object') return res.status(400).json({ error: 'Nothing to save.' });
  let name = file;
  if (name) {
    if (!/^[\w-]+\.json$/.test(name)) return res.status(400).json({ error: 'Bad file name.' });
  } else {
    name = freeName(BOARDS_DIR, slug(board.title), '.json');
  }
  // The editor sends the file nicely laid out ("text"); make sure it really is the same board before writing it.
  let text = JSON.stringify(board, null, 2) + '\n';
  if (typeof req.body.text === 'string') {
    try {
      if (JSON.stringify(JSON.parse(req.body.text)) === JSON.stringify(board)) text = req.body.text;
    } catch { /* fall back to the plain layout */ }
  }
  fs.writeFileSync(path.join(BOARDS_DIR, name), text);
  res.json({ file: name });
});

// Save a picture. The picture is the request body; ?board=<board file> and ?name=<original file name>.
// Returns the path to write in the board file, e.g. "images/my-board/cat.png".
app.post('/api/jeopardy/images', onlyThisComputer, express.raw({ type: 'image/*', limit: '20mb' }), (req, res) => {
  const ext = PICTURE_TYPES[req.headers['content-type']];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ error: 'Please choose a picture file (PNG, JPG, GIF, WEBP or SVG).' });
  }
  const folder = slug(String(req.query.board || 'new-board').replace(/\.json$/i, ''));
  const dir = path.join(IMAGES_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const base = slug(String(req.query.name || 'picture').replace(/\.[^.]+$/, '')) || 'picture';
  const name = freeName(dir, base, ext);
  fs.writeFileSync(path.join(dir, name), req.body);
  res.json({ path: `images/${folder}/${name}` });
});

// On Vercel / any cloud host, return null so the browser keeps window.location.origin.
// Locally, return the LAN IP so students' phones can connect.
app.get('/api/info', (req, res) => {
  if (process.env.VERCEL) {
    res.json({ ip: null, port: null });
  } else {
    res.json({ ip: getLocalIP(), port: PORT });
  }
});

app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/codenames', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/setup',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'setup.html')));
app.get('/spymaster', (req, res) => res.sendFile(path.join(__dirname, 'public', 'spymaster.html')));
app.get('/jeopardy',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'jeopardy.html')));

// Export for Vercel (serverless); listen directly when run locally.
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('\n  Codenames is running!\n');
    console.log(`  Projector:  http://localhost:${PORT}/setup`);
    console.log(`  Network:    http://${ip}:${PORT}\n`);
    console.log('  Open the Projector URL on the classroom computer to start a game.');
    console.log('  Spymasters will scan QR codes shown at game start.\n');
    console.log(`  Jeopardy:   http://localhost:${PORT}/jeopardy\n`);
  });
}

module.exports = app;
