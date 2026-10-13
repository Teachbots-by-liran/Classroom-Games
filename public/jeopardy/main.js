// Jeopardy — starts the game and moves between screens:
//   setup → board → Final Round (optional) → winners
//
// If the page is refreshed during a game, the game comes straight back to the same screen.
// An older saved game (from an earlier lesson) is offered on the setup screen instead.

import { showSetup } from './setup-screen.js';
import { showBoard } from './board-screen.js';
import { showFinalRound } from './final-round.js';
import { showWinnerScreen } from './winner-screen.js';
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
