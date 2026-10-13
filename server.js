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
