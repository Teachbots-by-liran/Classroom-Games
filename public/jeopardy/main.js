// Jeopardy — starts the game and moves between screens.

import { showSetup } from './setup-screen.js';
import { showBoard } from './board-screen.js';

const app = document.getElementById('app');

showSetup(app, {
  onStart(game) {
    showBoard(app, game);
  },
});
