// The board editor: make or change a board without touching any files by hand.
//
// Left: the grid (category names + one tile per question) and buttons for the Final Round and settings.
// Right: a form for whatever is selected. Pictures are copied into the boards/images folder when chosen.
// Unsaved work is kept in the browser, so a refresh loses nothing.

import { esc } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { toast } from '../shared/toast.js';
import { chooseDialog, confirmDialog } from '../shared/dialog.js';
import { createSavedState } from '../shared/saved-state.js';
import { checkBoard } from './board-file.js';
import { importDialog } from './import-dialog.js';
import { deleteBrowserBoard, getBrowserBoard, isBrowserBoard, pictureToData, saveBrowserBoard, serverCanSave } from './my-boards.js';

const DRAFT = createSavedState('jeopardy-editor-draft');
const LETTERS = 'ABCDEF';
const MAX_CATEGORIES = 6;
const QUESTIONS = 5;
const MAX_CHOICES = 6;
const PICTURE = /^image\/(png|jpeg|gif|webp|svg\+xml)$/;

const EXTRA_ICONS = {
  picture: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M3.5 18l5.5-5.5 4 4 2.5-2.5 5 5"/></svg>',
  choices: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 6h11M10 12h11M10 18h11"/><circle cx="4.5" cy="6" r="1.6" fill="currentColor"/><circle cx="4.5" cy="12" r="1.6" fill="currentColor"/><circle cx="4.5" cy="18" r="1.6" fill="currentColor"/></svg>',
  quote: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4 17.5c0-4 1.5-8 6-10.5l1 1.6C8.5 10.3 7.6 12 7.5 13.5H10V19H4zM13 17.5c0-4 1.5-8 6-10.5l1 1.6c-2.5 1.7-3.4 3.4-3.5 4.9H19V19h-6z"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14 1.7 9l7.2-.9z"/></svg>',
  gear: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  download: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v12M7 11l5 5 5-5M4.5 20.5h15"/></svg>',
  save: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M5 3.5h11l3.5 3.5v13.5h-15z"/><path d="M8 3.5v5h7v-5M8 20.5v-6h8v6"/></svg>',
};

// ---------- Converting between the board file and the editor ----------

function emptyQuestion() {
  return { question: '', quote: '', image: '', imageIdea: '', answer: '', explain: '', answerImage: '', points: '', mc: false, choices: ['', '', '', ''], correct: 0 };
}

function blankBoard() {
  return {
    title: '',
    timerSeconds: 30,
    dd: { mode: 'random', c: 0, r: 4 },
    categories: Array.from({ length: 5 }, () => ({ name: '', questions: Array.from({ length: QUESTIONS }, emptyQuestion) })),
    final: { on: true, category: '', ...emptyQuestion() },
  };
}

function correctIndex(choices, answer) {
  const a = String(answer || '').trim();
  const byText = choices.findIndex(c => c.trim().toLowerCase() === a.toLowerCase());
  if (byText >= 0) return byText;
  const byLetter = LETTERS.indexOf(a.toUpperCase());
  return a.length === 1 && byLetter >= 0 && byLetter < choices.length ? byLetter : 0;
}

function fromFileQuestion(q = {}, r = 0) {
  const mc = Array.isArray(q.choices);
  const choices = mc ? q.choices.map(String) : ['', '', '', ''];
  return {
    question: q.question || '', quote: q.quote || '', image: q.image || '', imageIdea: q.imageIdea || '',
    answer: mc ? '' : (q.answer ?? '') + '', explain: q.explain || '', answerImage: q.answerImage || '',
    points: q.points !== undefined && Number(q.points) !== (r + 1) * 100 ? String(q.points) : '',
    mc, choices, correct: mc ? correctIndex(choices, q.answer) : 0,
  };
}

function fromFile(raw) {
  const b = blankBoard();
  b.title = raw.title || '';
  b.timerSeconds = raw.timerSeconds ?? 30;
  if (raw.dailyDouble === 'none' || raw.dailyDouble === false) b.dd.mode = 'none';
  else if (raw.dailyDouble && typeof raw.dailyDouble === 'object') {
    b.dd = { mode: 'fixed', c: Number(raw.dailyDouble.category) - 1, r: Number(raw.dailyDouble.question) - 1 };
  }
  const cats = Array.isArray(raw.categories) ? raw.categories.slice(0, MAX_CATEGORIES) : [];
  if (cats.length) {
    b.categories = cats.map(cat => {
      const qs = Array.isArray(cat.questions) ? cat.questions : [];
      return { name: cat.name || '', questions: Array.from({ length: Math.max(QUESTIONS, qs.length) }, (_, r) => fromFileQuestion(qs[r], r)).slice(0, QUESTIONS) };
    });
  }
  if (raw.final) b.final = { on: true, category: raw.final.category || '', ...fromFileQuestion(raw.final, -1) };
  else b.final.on = false;
  return b;
}

// Only write the fields that are filled in, in a friendly order.
function toFileQuestion(q, r) {
  const out = {};
  if (r >= 0 && q.points !== '' && Number(q.points) !== (r + 1) * 100) out.points = Number(q.points);
  for (const key of ['question', 'quote', 'image']) if (q[key].trim()) out[key] = q[key].trim();
  if (!q.image && q.imageIdea.trim()) out.imageIdea = q.imageIdea.trim(); // a note for the teacher: which picture to find
  if (q.mc) {
    out.choices = q.choices.map(c => c.trim());
    out.answer = out.choices[q.correct] ?? '';
  } else if (q.answer.trim()) {
    out.answer = q.answer.trim();
  }
  if (q.explain.trim()) out.explain = q.explain.trim();
  if (q.answerImage.trim()) out.answerImage = q.answerImage.trim();
  return out;
}

function toFile(b) {
  const raw = { title: b.title.trim(), timerSeconds: Number(b.timerSeconds) || 30 };
  raw.dailyDouble = b.dd.mode === 'fixed' ? { category: b.dd.c + 1, question: b.dd.r + 1 } : b.dd.mode;
  raw.categories = b.categories.map(cat => ({ name: cat.name.trim(), questions: cat.questions.map(toFileQuestion) }));
  if (b.final.on) raw.final = { category: b.final.category.trim(), ...toFileQuestion(b.final, -1) };
  return raw;
}

// The same layout as the sample boards: one question per line, easy to read and edit by hand.
function layout(raw) {
  const value = v => (Array.isArray(v) ? `[${v.map(x => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v));
  const line = obj => (Object.keys(obj).length
    ? `{ ${Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}: ${value(v)}`).join(', ')} }`
    : '{}');
  const parts = ['{'];
  parts.push(`  "title": ${JSON.stringify(raw.title)},`);
  parts.push(`  "timerSeconds": ${raw.timerSeconds},`);
  parts.push(`  "dailyDouble": ${typeof raw.dailyDouble === 'object' ? line(raw.dailyDouble) : JSON.stringify(raw.dailyDouble)},`);
  parts.push('  "categories": [');
  raw.categories.forEach((cat, c) => {
    parts.push('    {');
    parts.push(`      "name": ${JSON.stringify(cat.name)},`);
    parts.push('      "questions": [');
    cat.questions.forEach((q, r) => parts.push(`        ${line(q)}${r < cat.questions.length - 1 ? ',' : ''}`));
    parts.push('      ]');
    parts.push(`    }${c < raw.categories.length - 1 ? ',' : ''}`);
  });
  parts.push(`  ]${raw.final ? ',' : ''}`);
  if (raw.final) parts.push(`  "final": ${line(raw.final)}`);
  parts.push('}');
  return parts.join('\n') + '\n';
}

function isEmpty(q) {
  return !q.question.trim() && !q.quote.trim() && !q.image && !q.answer.trim() && !(q.mc && q.choices.some(c => c.trim()));
}

// ---------- The editor screen ----------

// onDone(file): leave the editor. onSaved(file): the board was saved (a new board gets its file name now).
export async function showEditor(app, { file = null, onDone, onSaved = () => {} }) {
  // On the laptop boards are saved as files; online they are saved inside this browser.
  const toFolder = await serverCanSave();
  let board;
  if (file && isBrowserBoard(file)) {
    const raw = await getBrowserBoard(file);
    if (!raw) {
      toast(`${ICONS.warning} This board is no longer saved in this browser.`, 4000);
      return onDone(null);
    }
    board = fromFile(raw);
  } else if (file) {
    const res = await fetch('/boards/' + encodeURIComponent(file), { cache: 'no-store' });
    try {
      board = fromFile(JSON.parse(await res.text()));
    } catch {
      toast(`${ICONS.warning} This file has a typing mistake. Fix it in a text editor first.`, 4000);
      return onDone(null);
    }
  } else {
    board = blankBoard();
  }

  // Unsaved work from last time?
  const draft = DRAFT.load();
  if (draft && draft.file === file && draft.board) {
    const restore = await confirmDialog({
      title: 'Unsaved changes found', text: 'You changed this board but didn’t save. Keep those changes?',
      ok: 'Keep my changes', cancel: 'Throw them away',
    });
    if (restore) board = draft.board;
    else DRAFT.clear();
  }

  let selected = { type: 'tile', c: 0, r: 0 };
  let dirty = !!(draft && draft.file === file && board === draft.board);
  let saving = false;

  app.innerHTML = `
    <div class="screen editor">
      <header class="ed-top">
        <button class="q-btn" data-action="back" title="Back to the boards">${ICONS.undo}</button>
        <input class="ed-title" data-field="title" placeholder="Board title, e.g. Unit 3: Food" maxlength="60" spellcheck="true">
        <span class="ed-status" aria-live="polite"></span>
        <button class="ed-btn ed-import" data-action="import" title="Fill in the whole board at once, e.g. from Claude">${ICONS.plus}<span>Import</span></button>
        <button class="ed-btn ed-import" data-action="download" title="Save this board as a file (pictures included), e.g. to use on another computer">${EXTRA_ICONS.download}<span>Download</span></button>
        <button class="start-btn ed-save" data-action="save">${EXTRA_ICONS.save}SAVE</button>
      </header>
      <div class="ed-main">
        <section class="ed-left">
          <div class="ed-grid"></div>
          <div class="ed-extra">
            <button class="ed-extra-btn" data-select="final">${ICONS.flag}<span>Final Round</span></button>
            <button class="ed-extra-btn" data-select="settings">${EXTRA_ICONS.gear}<span>Settings</span></button>
            <button class="ed-extra-btn ed-add-cat" data-action="add-cat">${ICONS.plus}<span>Category</span></button>
          </div>
          <div class="ed-problems"></div>
        </section>
        <section class="ed-panel"></section>
      </div>
    </div>`;
  const root = app.querySelector('.editor');
  const grid = root.querySelector('.ed-grid');
  const panel = root.querySelector('.ed-panel');
  root.querySelector('.ed-title').value = board.title;

  // ---------- Problems (the same checks the setup screen uses) ----------
  function problems() {
    return checkBoard(toFile(board), file || 'new.json').problems.filter(p => !p.includes('timerSeconds') || board.timerSeconds !== '');
  }
  function tileProblems(list, c, r) {
    return list.filter(p => p.startsWith(`Category ${c + 1}, question ${r + 1} `) || p.startsWith(`Category ${c + 1}, question ${r + 1}:`));
  }

  // Empty tiles and unnamed categories are counted in one line each; other problems are listed as they are.
  function friendlyProblems(list) {
    const out = [];
    let empty = 0;
    board.categories.forEach((cat, c) => cat.questions.forEach((q, r) => { if (isEmpty(q)) empty++; }));
    const unnamed = board.categories.filter(cat => !cat.name.trim()).length;
    if (empty) out.push(`${empty} tile${empty > 1 ? 's are' : ' is'} still empty.`);
    if (unnamed) out.push(`${unnamed} categor${unnamed > 1 ? 'ies need' : 'y needs'} a name.`);
    for (const p of list) {
      const m = /^Category (\d+), question (\d+)/.exec(p);
      if (m && isEmpty(board.categories[m[1] - 1]?.questions[m[2] - 1] || emptyQuestion())) continue;
      if (/^Category \d+ has no "name"/.test(p)) continue;
      out.push(p);
    }
    return out;
  }

  // ---------- Grid ----------
  function renderGrid() {
    const list = problems();
    const cats = board.categories;
    grid.style.setProperty('--cols', cats.length);
    grid.innerHTML = cats.map((cat, c) => `
      <div class="ed-cat">
        <textarea class="ed-cat-name" data-field="cat" data-c="${c}" rows="2" placeholder="Category ${c + 1}" maxlength="40" spellcheck="true">${esc(cat.name)}</textarea>
        ${cats.length > 1 ? `<button class="ed-cat-del" data-action="del-cat" data-c="${c}" title="Remove this category">${ICONS.close}</button>` : ''}
      </div>`).join('') +
      Array.from({ length: QUESTIONS }, (_, r) => cats.map((cat, c) => {
        const q = cat.questions[r];
        const empty = isEmpty(q);
        const bad = !empty && tileProblems(list, c, r).length > 0;
        const dd = board.dd.mode === 'fixed' && board.dd.c === c && board.dd.r === r;
        const on = selected.type === 'tile' && selected.c === c && selected.r === r;
        const pts = q.points !== '' ? q.points : (r + 1) * 100;
        return `
          <button class="ed-tile${empty ? ' empty' : bad ? ' bad' : ' ok'}${on ? ' on' : ''}" data-select="tile" data-c="${c}" data-r="${r}"
            aria-label="Category ${c + 1}, ${pts} points${empty ? ', empty' : bad ? ', needs fixing' : ', done'}">
            <span class="ed-tile-pts">${esc(pts)}</span>
            <span class="ed-tile-icons">${q.image ? EXTRA_ICONS.picture : q.imageIdea ? `<span class="want" title="Picture idea: ${esc(q.imageIdea)}">${EXTRA_ICONS.picture}</span>` : ''}${q.mc ? EXTRA_ICONS.choices : ''}${q.quote.trim() ? EXTRA_ICONS.quote : ''}${dd ? EXTRA_ICONS.star : ''}</span>
            <span class="ed-tile-state">${empty ? ICONS.plus : bad ? ICONS.warning : ICONS.check}</span>
          </button>`;
      }).join('')).join('');
    root.querySelectorAll('.ed-extra-btn[data-select]').forEach(b => b.classList.toggle('on', b.dataset.select === selected.type));
    root.querySelector('.ed-add-cat').hidden = cats.length >= MAX_CATEGORIES;

    const box = root.querySelector('.ed-problems');
    const shown = friendlyProblems(list);
    box.innerHTML = shown.length
      ? `<h3>${ICONS.warning} To finish before playing</h3><ul>${shown.slice(0, 8).map(p => `<li>${esc(p)}</li>`).join('')}${shown.length > 8 ? `<li>…and ${shown.length - 8} more</li>` : ''}</ul>`
      : `<h3 class="ok">${ICONS.check} Ready to play</h3>`;
    box.classList.toggle('ready', !shown.length);
  }

  // ---------- Right-hand form ----------
  function fieldText(label, field, value, { multiline = false, placeholder = '', hint = '' } = {}) {
    return `
      <label class="ed-field">
        <span class="ed-label">${label}${hint ? `<small>${hint}</small>` : ''}</span>
        ${multiline
          ? `<textarea data-field="${field}" rows="2" placeholder="${esc(placeholder)}" dir="auto">${esc(value)}</textarea>`
          : `<input data-field="${field}" value="${esc(value)}" placeholder="${esc(placeholder)}" dir="auto">`}
      </label>`;
  }

  function pictureField(label, field, value, idea = '') {
    return `
      <div class="ed-field">
        <span class="ed-label">${label}<small>optional</small></span>
        <div class="ed-picture${value ? ' has' : ''}" data-drop="${field}">
          ${value ? `<img src="${esc(value.startsWith('data:') ? value : '/boards/' + value)}" alt="">` : `<span class="ed-drop-hint">${EXTRA_ICONS.picture}Drop a picture here</span>${idea ? `<span class="ed-idea">Idea: ${esc(idea)}</span>` : ''}`}
        </div>
        <div class="ed-row">
          <label class="ed-btn">${EXTRA_ICONS.picture}<span>${value ? 'Change' : 'Choose'} picture</span>
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" data-upload="${field}" hidden>
          </label>
          ${value ? `<button class="ed-btn" data-action="remove-pic" data-field="${field}">${ICONS.close}<span>Remove</span></button>` : ''}
        </div>
      </div>`;
  }

  function questionForm(q, { final = false, c = 0, r = 0 } = {}) {
    const dd = !final && board.dd.mode === 'fixed' && board.dd.c === c && board.dd.r === r;
    return `
      ${final ? fieldText('Final Round category', 'f-category', q.category, { placeholder: 'e.g. Shakespeare' }) : ''}
      ${fieldText('Question', 'question', q.question, { multiline: true, placeholder: 'e.g. What idiom is this?' })}
      ${pictureField('Picture', 'image', q.image, q.imageIdea)}
      ${fieldText('Quote', 'quote', q.quote, { multiline: true, hint: 'optional · shown in big quote marks' })}
      <div class="ed-field">
        <span class="ed-label">Answer type</span>
        <div class="ed-seg" role="radiogroup">
          <button data-action="mc-off" role="radio" aria-checked="${!q.mc}">${ICONS.eye}<span>Say the answer</span></button>
          <button data-action="mc-on" role="radio" aria-checked="${q.mc}">${EXTRA_ICONS.choices}<span>Multiple choice</span></button>
        </div>
      </div>
      ${q.mc ? `
        <div class="ed-field">
          <span class="ed-label">Choices<small>tick the right one</small></span>
          <div class="ed-choices">
            ${q.choices.map((ch, i) => `
              <div class="ed-choice${i === q.correct ? ' right' : ''}">
                <span class="q-letter">${LETTERS[i]}</span>
                <input data-field="choice" data-i="${i}" value="${esc(ch)}" placeholder="Choice ${LETTERS[i]}" dir="auto">
                <button class="ed-right" data-action="correct" data-i="${i}" aria-pressed="${i === q.correct}" title="This is the right answer">${ICONS.check}</button>
                ${q.choices.length > 2 ? `<button class="ed-x" data-action="del-choice" data-i="${i}" title="Remove this choice">${ICONS.close}</button>` : ''}
              </div>`).join('')}
          </div>
          ${q.choices.length < MAX_CHOICES ? `<button class="ed-btn" data-action="add-choice">${ICONS.plus}<span>Add a choice</span></button>` : ''}
        </div>` : fieldText('Answer', 'answer', q.answer, { placeholder: 'e.g. A piece of cake' })}
      ${fieldText('Explanation', 'explain', q.explain, { hint: 'optional · shown under the answer' })}
      ${final ? '' : `
        <div class="ed-row ed-options">
          <label class="ed-points"><span>Points</span><input data-field="points" inputmode="numeric" value="${esc(q.points)}" placeholder="${(r + 1) * 100}"></label>
          <button class="ed-btn${dd ? ' on' : ''}" data-action="dd" aria-pressed="${dd}">${EXTRA_ICONS.star}<span>Daily Double here</span></button>
          <button class="ed-btn ed-clear" data-action="clear">${ICONS.close}<span>Clear tile</span></button>
        </div>`}`;
  }

  function current() {
    if (selected.type === 'tile') return board.categories[selected.c].questions[selected.r];
    if (selected.type === 'final') return board.final;
    return null;
  }

  function renderPanel() {
    if (selected.type === 'settings') {
      panel.innerHTML = `
        <h2 class="ed-h">${EXTRA_ICONS.gear} Settings</h2>
        <label class="ed-field"><span class="ed-label">Timer (seconds)</span>
          <input data-field="timer" inputmode="numeric" value="${esc(board.timerSeconds)}"></label>
        <div class="ed-field">
          <span class="ed-label">Daily Double</span>
          <div class="ed-seg" role="radiogroup">
            <button data-action="dd-mode" data-mode="random" role="radio" aria-checked="${board.dd.mode === 'random'}">${ICONS.dice}<span>Random tile</span></button>
            <button data-action="dd-mode" data-mode="fixed" role="radio" aria-checked="${board.dd.mode === 'fixed'}">${EXTRA_ICONS.star}<span>Tile I choose</span></button>
            <button data-action="dd-mode" data-mode="none" role="radio" aria-checked="${board.dd.mode === 'none'}">${ICONS.close}<span>None</span></button>
          </div>
          ${board.dd.mode === 'fixed' ? `<p class="ed-note">Now: category ${board.dd.c + 1}, ${(board.dd.r + 1) * 100} points. To change it, open a tile and press “Daily Double here”.</p>` : ''}
        </div>
        <div class="ed-field">
          <span class="ed-label">Saved where?</span>
          <p class="ed-note">${toFolder
            ? 'In the boards folder on this computer.'
            : 'In this browser, on this computer only. Use Download to keep a copy or to use the board on another computer (there: Import → choose the file).'}</p>
          ${isBrowserBoard(file) ? `<button class="ed-btn ed-clear" data-action="delete-board">${ICONS.close}<span>Delete this board</span></button>` : ''}
        </div>`;
      return;
    }
    if (selected.type === 'final') {
      const f = board.final;
      panel.innerHTML = `
        <h2 class="ed-h">${ICONS.flag} Final Round
          <button class="ed-btn" data-action="final-toggle" aria-pressed="${f.on}">${f.on ? 'ON' : 'OFF'}</button></h2>
        ${f.on ? questionForm(f, { final: true }) : `<p class="ed-note">This board has no Final Round. Press OFF to add one.</p>`}`;
      return;
    }
    const { c, r } = selected;
    const cat = board.categories[c];
    panel.innerHTML = `
      <h2 class="ed-h"><span class="ed-h-cat">${esc(cat.name || `Category ${c + 1}`)}</span><span class="q-pts">${esc(cat.questions[r].points || (r + 1) * 100)}</span></h2>
      ${questionForm(cat.questions[r], { c, r })}`;
  }

  function render() {
    renderGrid();
    renderPanel();
    showStatus();
  }

  // ---------- Saving ----------
  function changed() {
    dirty = true;
    DRAFT.save({ file, board, savedAt: Date.now() });
    showStatus();
  }

  function showStatus() {
    const s = root.querySelector('.ed-status');
    s.innerHTML = saving ? 'Saving…' : dirty ? `${ICONS.pencil}<span>Not saved yet</span>` : `${ICONS.check}<span>Saved</span>`;
    s.classList.toggle('dirty', dirty);
  }

  async function save() {
    if (!board.title.trim()) {
      toast(`${ICONS.warning} Please give the board a title first`, 2500);
      root.querySelector('.ed-title').focus();
      return false;
    }
    saving = true;
    showStatus();
    const raw = toFile(board);
    try {
      if (toFolder) {
        const res = await fetch('/api/jeopardy/boards', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file, board: raw, text: layout(raw) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save.');
        file = data.file;
      } else {
        // Online: keep it in this browser. A board from the boards folder becomes the teacher's own copy.
        file = await saveBrowserBoard(isBrowserBoard(file) ? file : null, raw);
      }
      DRAFT.clear();
      onSaved(file);
      dirty = false;
      const left = friendlyProblems(problems()).length;
      const where = toFolder ? '' : ' in this browser';
      toast(`${ICONS.check} Saved${where}${left ? ` · ${left} thing${left > 1 ? 's' : ''} left to finish` : ' · ready to play!'}`, 2600);
      return true;
    } catch (err) {
      toast(`${ICONS.warning} ${esc(err.message)}`, 4000);
      return false;
    } finally {
      saving = false;
      showStatus();
    }
  }

  async function back() {
    if (dirty) {
      const choice = await chooseDialog({
        title: 'Save your changes?',
        options: [
          { label: 'Save and go back', value: 'save', primary: true },
          { label: 'Go back without saving', value: 'leave', danger: true },
          { label: 'Keep editing', value: null },
        ],
      });
      if (!choice) return;
      if (choice === 'save' && !(await save())) return;
      if (choice === 'leave') DRAFT.clear();
    }
    removeEventListener('beforeunload', warnOnClose);
    onDone(file);
  }

  function warnOnClose(e) {
    if (dirty) DRAFT.save({ file, board, savedAt: Date.now() });
  }
  addEventListener('beforeunload', warnOnClose);

  // ---------- Download ----------
  // The file includes every picture, so it works on any computer (Import → choose the file).
  async function download() {
    toast(`${EXTRA_ICONS.download} Preparing the file…`, 1500);
    const raw = toFile(board);
    const questions = [...raw.categories.flatMap(c => c.questions), ...(raw.final ? [raw.final] : [])];
    for (const q of questions) {
      for (const key of ['image', 'answerImage']) {
        if (!q[key] || q[key].startsWith('data:')) continue;
        try {
          const res = await fetch('/boards/' + q[key].split('/').map(encodeURIComponent).join('/'));
          const blob = await res.blob();
          q[key] = await pictureToData(new File([blob], q[key], { type: blob.type }));
        } catch { /* leave the path; the picture just won't travel */ }
      }
    }
    const name = (raw.title || 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';
    const url = URL.createObjectURL(new Blob([layout(raw)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- Pictures ----------
  async function upload(fileObj, field) {
    if (!fileObj || !PICTURE.test(fileObj.type)) {
      toast(`${ICONS.warning} Please choose a picture (PNG, JPG, GIF, WEBP or SVG)`, 3000);
      return;
    }
    const folder = file || (board.title.trim() || 'new-board');
    toast(`${EXTRA_ICONS.picture} Adding picture…`, 1200);
    try {
      if (!toFolder) {
        current()[field] = await pictureToData(fileObj);
        changed();
        render();
        return;
      }
      const res = await fetch(`/api/jeopardy/images?board=${encodeURIComponent(folder)}&name=${encodeURIComponent(fileObj.name)}`, {
        method: 'POST', headers: { 'Content-Type': fileObj.type }, body: fileObj,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add the picture.');
      const q = current();
      q[field] = data.path;
      changed();
      render();
    } catch (err) {
      toast(`${ICONS.warning} ${esc(err.message)}`, 4000);
    }
  }

  // ---------- Events ----------
  root.addEventListener('input', e => {
    const t = e.target;
    const field = t.dataset.field;
    if (!field) return;
    const q = current();
    if (field === 'title') board.title = t.value;
    else if (field === 'cat') board.categories[Number(t.dataset.c)].name = t.value;
    else if (field === 'timer') board.timerSeconds = t.value.replace(/\D/g, '');
    else if (field === 'f-category') board.final.category = t.value;
    else if (field === 'choice') q.choices[Number(t.dataset.i)] = t.value;
    else if (field === 'points') { t.value = t.value.replace(/\D/g, ''); q.points = t.value; }
    else if (q && field in q) q[field] = t.value;
    changed();
    renderGrid();
    if (field === 'cat' && selected.type === 'tile' && Number(t.dataset.c) === selected.c) {
      panel.querySelector('.ed-h-cat').textContent = t.value || `Category ${selected.c + 1}`;
    }
    if (field === 'points') panel.querySelector('.q-pts').textContent = t.value || (selected.r + 1) * 100;
    // Keep typing in the same box after the grid is redrawn.
    if (field === 'cat') {
      const again = grid.querySelector(`[data-field="cat"][data-c="${t.dataset.c}"]`);
      again.focus();
      again.setSelectionRange(t.selectionStart, t.selectionEnd);
    }
  });

  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('ed-cat-name')) { e.preventDefault(); e.target.blur(); }
  });

  root.addEventListener('change', e => {
    const up = e.target.dataset.upload;
    if (up) upload(e.target.files[0], up);
  });

  root.addEventListener('click', async e => {
    const sel = e.target.closest('[data-select]');
    if (sel) {
      selected = sel.dataset.select === 'tile'
        ? { type: 'tile', c: Number(sel.dataset.c), r: Number(sel.dataset.r) }
        : { type: sel.dataset.select };
      render();
      panel.scrollTop = 0;
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const q = current();
    const i = Number(btn.dataset.i);
    switch (btn.dataset.action) {
      case 'back': return back();
      case 'save': await save(); return;
      case 'download': await download(); return;
      case 'delete-board': {
        if (!(await confirmDialog({ title: 'Delete this board?', text: 'It will be removed from this browser. This can\u2019t be undone.', ok: 'Delete', danger: true }))) return;
        await deleteBrowserBoard(file);
        DRAFT.clear();
        removeEventListener('beforeunload', warnOnClose);
        toast(`${ICONS.check} Board deleted`, 2000);
        return onDone(null);
      }
      case 'import': {
        const raw = await importDialog();
        if (!raw) return;
        const hasWork = board.categories.some(cat => cat.name.trim() || cat.questions.some(qq => !isEmpty(qq)));
        if (hasWork && !(await confirmDialog({ title: 'Replace this board?', text: 'Everything on it now will be replaced by the imported board.', ok: 'Replace', danger: true }))) return;
        const title = board.title;
        board = fromFile(raw);
        if (!board.title.trim()) board.title = title;
        root.querySelector('.ed-title').value = board.title;
        selected = { type: 'tile', c: 0, r: 0 };
        const ideas = board.categories.reduce((n, cat) => n + cat.questions.filter(qq => qq.imageIdea && !qq.image).length, 0);
        toast(`${ICONS.check} Imported! Check the tiles${ideas ? `, add ${ideas} picture${ideas > 1 ? 's' : ''}` : ''}, then Save`, 4000);
        break;
      }
      case 'mc-on': q.mc = true; if (q.choices.length < 2) q.choices = ['', '', '', '']; if (q.answer.trim() && !q.choices.some(c => c.trim())) q.choices[0] = q.answer.trim(); break;
      case 'mc-off': if (q.mc && !q.answer.trim()) q.answer = q.choices[q.correct] || ''; q.mc = false; break;
      case 'correct': q.correct = i; break;
      case 'add-choice': q.choices.push(''); break;
      case 'del-choice': q.choices.splice(i, 1); if (q.correct >= q.choices.length) q.correct = 0; else if (i < q.correct) q.correct--; break;
      case 'remove-pic': q[btn.dataset.field] = ''; break;
      case 'final-toggle': board.final.on = !board.final.on; break;
      case 'dd-mode': board.dd.mode = btn.dataset.mode; break;
      case 'dd': {
        const here = board.dd.mode === 'fixed' && board.dd.c === selected.c && board.dd.r === selected.r;
        board.dd = here ? { ...board.dd, mode: 'random' } : { mode: 'fixed', c: selected.c, r: selected.r };
        break;
      }
      case 'clear': {
        const sure = isEmpty(q) || await confirmDialog({ title: 'Clear this tile?', text: 'The question and answer will be removed.', ok: 'Clear', danger: true });
        if (!sure) return;
        board.categories[selected.c].questions[selected.r] = emptyQuestion();
        break;
      }
      case 'add-cat':
        if (board.categories.length >= MAX_CATEGORIES) return;
        board.categories.push({ name: '', questions: Array.from({ length: QUESTIONS }, emptyQuestion) });
        selected = { type: 'tile', c: board.categories.length - 1, r: 0 };
        break;
      case 'del-cat': {
        const c = Number(btn.dataset.c);
        const cat = board.categories[c];
        const hasWork = cat.name.trim() || cat.questions.some(qq => !isEmpty(qq));
        if (hasWork && !(await confirmDialog({ title: `Remove "${cat.name || `Category ${c + 1}`}"?`, text: 'All its questions will be removed.', ok: 'Remove', danger: true }))) return;
        board.categories.splice(c, 1);
        if (board.dd.mode === 'fixed' && board.dd.c === c) board.dd.mode = 'random';
        else if (board.dd.mode === 'fixed' && board.dd.c > c) board.dd.c--;
        if (selected.type === 'tile') selected = { type: 'tile', c: Math.min(selected.c, board.categories.length - 1), r: selected.r };
        break;
      }
      default: return;
    }
    changed();
    render();
  });

  // Drag a picture from the computer onto the picture box.
  root.addEventListener('dragover', e => {
    const box = e.target.closest('[data-drop]');
    if (!box) return;
    e.preventDefault();
    box.classList.add('drag');
  });
  root.addEventListener('dragleave', e => e.target.closest('[data-drop]')?.classList.remove('drag'));
  root.addEventListener('drop', e => {
    const box = e.target.closest('[data-drop]');
    if (!box) return;
    e.preventDefault();
    box.classList.remove('drag');
    upload(e.dataTransfer.files[0], box.dataset.drop);
  });

  render();
  if (!board.title) root.querySelector('.ed-title').focus();
}
