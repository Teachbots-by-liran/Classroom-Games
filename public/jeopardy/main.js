// Jeopardy — starts the game and moves between screens.
//
// If the page is refreshed during a game, the game comes straight back.
// An older saved game (from an earlier lesson) is offered on the setup screen instead.

import { showSetup } from './setup-screen.js';
import { showBoard } from './board-screen.js';
import { clearGame, isRecent, loadGame, newGame, saveGame } from './game-state.js';

const app = document.getElementById('app');

function play(game) {
  showBoard(app, game, {
    onNewGame() {
      clearGame();
      setup();
    },
  });
}

function setup() {
  showSetup(app, {
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
if (saved && isRecent(saved)) play(saved);
else setup();
