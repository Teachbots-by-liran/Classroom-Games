// Jeopardy — starts the game and moves between screens:
//   setup → board → Final Round (optional) → winners
//
// If the page is refreshed during a game, the game comes straight back to the same screen.
// An older saved game (from an earlier lesson) is offered on the setup screen instead.

import { showSetup } from './setup-screen.js';
import { showBoard } from './board-screen.js';
import { showFinalRound } from './final-round.js';
import { showWinnerScreen } from './winner-screen.js';
import { showEditor } from './editor.js';
import { clearGame, isRecent, loadGame, newGame, saveGame, showWinners, startFinal } from './game-state.js';

const app = document.getElementById('app');

function play(game) {
  if (game.phase === 'final') return finalRound(game);
  if (game.phase === 'winners') return winners(game);
  game.phase = 'board';
  showBoard(app, game, {
    onBoardDone: () => (game.finalRound ? finalRound(game) : winners(game)),
    onWinners: () => winners(game),
    onNewGame: setupNew,
  });
}

function finalRound(game) {
  startFinal(game);
  showFinalRound(app, game, {
    onWinners: () => winners(game),
    onBackToBoard: () => {
      game.phase = 'board';
      saveGame(game);
      play(game);
    },
    onNewGame: setupNew,
  });
}

function winners(game) {
  showWinners(game);
  showWinnerScreen(app, game, { onNewGame: setupNew });
}

function setupNew() {
  clearGame();
  setup();
}

// The board editor, opened from setup. Coming back selects the board that was edited.
// A refresh while editing reopens the editor (sessionStorage only lasts while this browser tab is open).
function editor(file) {
  try { sessionStorage.setItem('jeopardy-editing', file || ''); } catch { /* ignore */ }
  showEditor(app, {
    file,
    onSaved: f => { try { sessionStorage.setItem('jeopardy-editing', f); } catch { /* ignore */ } },
    onDone: saved => {
      try { sessionStorage.removeItem('jeopardy-editing'); } catch { /* ignore */ }
      setup(saved);
    },
  });
}

function editingAfterRefresh() {
  try { return sessionStorage.getItem('jeopardy-editing'); } catch { return null; }
}

function setup(selectFile = null) {
  showSetup(app, {
    selectFile,
    onEdit: editor,
    resumeGame: loadGame(),
    onResume: play,
    onStart(choices) {
      const game = newGame(choices);
      saveGame(game);
      play(game);
    },
  });
}

const saved = loadGame();
const editing = editingAfterRefresh();
if (editing !== null) editor(editing || null);
else if (saved && isRecent(saved)) play(saved);
else setup();
