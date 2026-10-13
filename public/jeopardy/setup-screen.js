// The setup screen: choose a board, name the teams, choose who picks first, then start.

import { esc, fitText } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { MAX_TEAMS, teamBadge, teamLook } from '../shared/team-looks.js';
import { createSavedState } from '../shared/saved-state.js';
import { listBoards, loadBoard } from './board-file.js';

const MIN_TEAMS = 2;
const remembered = createSavedState('jeopardy-setup'); // last team names and board, for next lesson

// onEdit(file) opens the board editor (file = null for a new board). selectFile: the board to select first.
export async function showSetup(app, { onStart, resumeGame = null, onResume, onEdit, selectFile = null }) {
  const last = remembered.load() || {};
  const state = {
    boards: [],
    file: selectFile || last.file || null,
    board: null,
    problems: [],
    teams: Array.isArray(last.teams) && last.teams.length >= MIN_TEAMS
      ? last.teams.slice(0, MAX_TEAMS)
      : ['Team 1', 'Team 2', 'Team 3', 'Team 4'],
    first: 0,
    finalRound: true,
    timerSeconds: null, // null = use the board's own setting
  };

  app.innerHTML = `
    <div class="screen setup">
      <div class="setup-top">
        <div class="logo">JEOPARDY!</div>
        ${resumeGame ? `<button class="resume-btn" data-action="resume">${ICONS.play}<span>Continue last game</span>
          <small>${esc(resumeGame.board.title)} · ${resumeGame.teams.length} teams</small></button>` : ''}
      </div>
      <div class="setup-body">
        <section class="panel">
          <div class="panel-head">
            <h2><span class="step-num">1</span>Board</h2>
            <button class="ghost-btn" data-action="new-board" title="Make a new board">${ICONS.plus}New board</button>
          </div>
          <div class="board-list" role="list"></div>
          <div class="problems" hidden></div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <h2><span class="step-num">2</span>Teams</h2>
            <button class="ghost-btn" data-action="random-first" title="Choose who picks first at random">${ICONS.dice}Random first</button>
          </div>
          <div class="team-list"></div>
          <div class="options">
            <div class="option">${ICONS.flag}Final Round <button class="switch" data-action="final" aria-pressed="true">ON</button></div>
            <div class="option">${ICONS.timer}Timer
              <span class="stepper">
                <button data-action="timer-down" aria-label="Less time">−</button>
                <output class="timer-value">30s</output>
                <button data-action="timer-up" aria-label="More time">+</button>
              </span>
            </div>
          </div>
          <button class="start-btn" data-action="start" disabled>START GAME ${ICONS.play}</button>
        </section>
      </div>
    </div>`;

  const root = app.querySelector('.setup');
  const $ = sel => root.querySelector(sel);
  const boardList = $('.board-list');
  const teamList = $('.team-list');
  const problemsBox = $('.problems');

  // ---------- Boards ----------
  function renderBoards() {
    if (state.boards.length === 0) {
      boardList.innerHTML = `<p class="board-cats">No board files found in the boards folder.</p>`;
      return;
    }
    boardList.innerHTML = state.boards.map(b => `
      <div class="board-item">
        <button class="board-card${b.error ? ' broken' : ''}" data-file="${esc(b.file)}" aria-pressed="${b.file === state.file}">
          <span class="board-title">${b.error ? ICONS.warning + ' ' : ''}${esc(b.title)}</span>
          <span class="board-cats">${b.error ? 'Needs fixing (select to see why)' : esc(b.categories.filter(Boolean).join(' · ') || 'No categories yet')}</span>
          <span class="board-check">${ICONS.check}</span>
        </button>
        ${b.error ? '' : `<button class="board-edit" data-action="edit" data-file="${esc(b.file)}" title="Edit this board">${ICONS.pencil}</button>`}
      </div>`).join('');
    boardList.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  async function selectBoard(file) {
    state.file = file;
    state.board = null;
    state.problems = [];
    renderBoards();
    updateStart();
    const { board, problems } = await loadBoard(file);
    if (state.file !== file) return; // another board was chosen meanwhile
    state.board = board;
    state.problems = problems;
    if (state.timerSeconds === null && board) setTimer(board.timerSeconds, false);
    renderProblems();
    renderOptions();
    updateStart();
    boardList.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function renderProblems() {
    if (state.problems.length === 0) {
      problemsBox.hidden = true;
      return;
    }
    problemsBox.hidden = false;
    problemsBox.innerHTML = `
      <h3>${ICONS.warning} This board needs fixing</h3>
      <ul>${state.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
  }

  // ---------- Teams ----------
  function renderTeams() {
    teamList.innerHTML = state.teams.map((name, i) => `
      <div class="setup-team${i === state.first ? ' first' : ''}" style="--team:${teamLook(i).color}">
        ${i === state.first ? `<span class="first-tag">${ICONS.play}First</span>` : ''}
        ${teamBadge(i)}
        <input class="team-name-input" data-team="${i}" value="${esc(name)}" maxlength="16" aria-label="Team ${i + 1} name" spellcheck="false">
        <button class="first-btn" data-action="first" data-team="${i}" aria-pressed="${i === state.first}" title="Picks first">${ICONS.play}</button>
        ${state.teams.length > MIN_TEAMS
          ? `<button class="remove-btn" data-action="remove" data-team="${i}" title="Remove team">${ICONS.close}</button>` : ''}
      </div>`).join('') +
      (state.teams.length < MAX_TEAMS
        ? `<button class="add-team" data-action="add">${ICONS.plus} Team</button>` : '');
    document.fonts.ready.then(() => teamList.querySelectorAll('.team-name-input').forEach(inp => fitText(inp, 12)));
  }

  // ---------- Options ----------
  function setTimer(seconds, userChoice = true) {
    const s = Math.max(5, Math.min(120, seconds));
    if (userChoice) state.timerSeconds = s;
    $('.timer-value').textContent = s + 's';
    $('.timer-value').dataset.seconds = s;
  }

  function renderOptions() {
    const sw = $('[data-action="final"]');
    const hasFinal = !!(state.board && state.board.final);
    sw.disabled = state.board && !hasFinal;
    const on = state.finalRound && (!state.board || hasFinal);
    sw.setAttribute('aria-pressed', on);
    sw.textContent = on ? 'ON' : 'OFF';
    sw.title = state.board && !hasFinal ? 'This board has no Final Round question' : '';
  }

  function updateStart() {
    const ok = state.board && state.problems.length === 0 && state.teams.every(n => n.trim());
    $('.start-btn').disabled = !ok;
  }

  // ---------- Events ----------
  root.addEventListener('click', e => {
    const card = e.target.closest('.board-card');
    if (card) return selectBoard(card.dataset.file);
    const edit = e.target.closest('[data-action="edit"], [data-action="new-board"]');
    if (edit) return onEdit(edit.dataset.action === 'edit' ? edit.dataset.file : null);

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const i = Number(btn.dataset.team);
    switch (btn.dataset.action) {
      case 'add':
        state.teams.push('Team ' + (state.teams.length + 1));
        renderTeams();
        teamList.querySelector(`.team-name-input[data-team="${state.teams.length - 1}"]`).select();
        break;
      case 'remove':
        state.teams.splice(i, 1);
        if (state.first >= state.teams.length) state.first = 0;
        renderTeams();
        break;
      case 'first':
        state.first = i;
        renderTeams();
        break;
      case 'random-first':
        state.first = Math.floor(Math.random() * state.teams.length);
        renderTeams();
        break;
      case 'final':
        state.finalRound = !state.finalRound;
        renderOptions();
        break;
      case 'timer-down':
        setTimer(Number($('.timer-value').dataset.seconds) - 5);
        break;
      case 'timer-up':
        setTimer(Number($('.timer-value').dataset.seconds) + 5);
        break;
      case 'start':
        start();
        break;
      case 'resume':
        onResume(resumeGame);
        return;
    }
    updateStart();
  });

  root.addEventListener('input', e => {
    if (e.target.classList.contains('team-name-input')) {
      state.teams[Number(e.target.dataset.team)] = e.target.value;
      fitText(e.target, 12);
      updateStart();
    }
  });

  function start() {
    const names = state.teams.map(n => n.trim());
    remembered.save({ file: state.file, teams: names });
    document.documentElement.requestFullscreen?.().catch(() => {});
    onStart({
      board: state.board,
      teams: names.map(name => ({ name, score: 0 })),
      turn: state.first,
      finalRound: state.finalRound && !!state.board.final,
      timerSeconds: Number($('.timer-value').dataset.seconds),
    });
  }

  // ---------- First draw ----------
  renderTeams();
  renderOptions();
  setTimer(30, false);
  try {
    state.boards = await listBoards();
  } catch {
    state.boards = [];
  }
  renderBoards();
  const startFile = state.boards.some(b => b.file === state.file) ? state.file : state.boards[0]?.file;
  if (startFile) selectBoard(startFile);
}
