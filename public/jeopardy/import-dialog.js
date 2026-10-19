// Import a whole board at once — for example one written by Claude.
//
//   1. Type the topic and the class level, then copy a ready-made prompt for Claude.
//   2. Paste Claude's answer (or choose a .json / .txt file) and press Import.
//
// The answer is the normal board-file format. Small slips are forgiven: text around the board,
// ```json code fences, curly quotes around names, and commas before } or ].

import { esc } from '../shared/dom.js';
import { ICONS } from '../shared/icons.js';
import { pushKeys } from '../shared/keys.js';
import { toast } from '../shared/toast.js';
import { describeJsonError } from './board-file.js';

const REMEMBER = 'jeopardy-import-topic';

// pictures: false (default) = every question works with text only, no pictures needed.
export function claudePrompt(topic, level, pictures = false) {
  return `Please create a Jeopardy quiz board for my English (EFL) class.

Topic: ${topic || '[write the topic here]'}
Students: ${level || 'high school, intermediate (B1)'}

Reply with ONLY one JSON code block, in exactly this format:

{
  "title": "Short board title",
  "timerSeconds": 30,
  "dailyDouble": "random",
  "categories": [
    {
      "name": "Category name",
      "questions": [
        { "question": "...", "answer": "..." },
        { "question": "...", "answer": "...", "explain": "..." },
        { "question": "...", "choices": ["...", "...", "...", "..."], "answer": "..." },
${pictures ? '        { "question": "What is this?", "imageIdea": "...", "answer": "..." },\n' : ''}        { "question": "Who said this?", "quote": "...", "answer": "..." }
      ]
    }
  ],
  "final": { "category": "...", "question": "...", "answer": "..." }
}

Rules:
- Exactly 5 categories. Each has exactly 5 questions, from easiest (100 points) to hardest (500 points).
- Category names: 1 to 3 words.
- Questions are read from a projector, so keep them short: at most about 15 words.
- Every question has "question" and "answer".
- Optional "explain": a very short note shown after the answer (for example a meaning or a rule).
- Optional "quote": a quotation shown in big letters above the question.
- Make about a third of the questions multiple choice: add "choices" with 4 short options and write the correct option's exact text as "answer".
${pictures
    ? '- My students love pictures. For every question that would work well with a picture, add "imageIdea": a short description of a picture I can find (I will add the picture myself), and write the question so it works with that picture.'
    : '- Do NOT use pictures: every question must be answerable from its text alone. No "What is this?" or "What is in the picture?" questions, and no "imageIdea" or "image".'}
- Use straight double quotes, no comments and no trailing commas.`;
}

// Turn pasted text into a board object. Returns { raw } or { error }.
export function parseBoardText(text) {
  let t = String(text || '').trim();
  if (!t) return { error: 'Paste Claude’s answer into the box first.' };
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return { error: 'I couldn’t find a board in that text. It should start with { and end with }.' };
  t = t.slice(start, end + 1);

  // Try the text as it is first, then with small slips fixed.
  const noCommas = s => s.replace(/,(\s*[}\]])/g, '$1');            // comma before } or ]
  const straight = s => s.replace(/[“”]/g, '"');          // curly double quotes → straight
  let raw = null;
  let firstError = null;
  for (const attempt of [t, noCommas(t), straight(noCommas(t))]) {
    try {
      raw = JSON.parse(attempt);
      break;
    } catch (err) {
      firstError = firstError || err;
    }
  }
  if (!raw) return { error: describeJsonError(t, firstError) };
  if (!Array.isArray(raw.categories) || raw.categories.length === 0) {
    return { error: 'This board has no "categories" list, so there is nothing to import.' };
  }
  return { raw };
}

// Shows the import box. Resolves with the board object, or null if cancelled.
export function importDialog() {
  return new Promise(resolve => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(REMEMBER)) || {}; } catch { /* ignore */ }

    const el = document.createElement('div');
    el.className = 'dialog-backdrop';
    el.innerHTML = `
      <div class="dialog import" role="dialog" aria-modal="true" aria-label="Import a board">
        <h2>${ICONS.plus} Import a whole board</h2>
        <ol class="import-steps">
          <li>
            <span class="import-step-title">Tell Claude what you need</span>
            <div class="import-row">
              <label>Topic<input data-k="topic" value="${esc(saved.topic || '')}" placeholder="e.g. Food and cooking"></label>
              <label>Students<input data-k="level" value="${esc(saved.level || '')}" placeholder="e.g. Grade 10, B1"></label>
            </div>
            <label class="import-check"><input type="checkbox" data-k="pictures"${saved.pictures ? ' checked' : ''}>
              <span>Include picture questions <small>(you add the pictures yourself)</small></span></label>
            <button class="dialog-btn primary" data-action="copy">${ICONS.check}<span>Copy prompt for Claude</span></button>
            <small>Then paste it into Claude (claude.ai) and send it.</small>
          </li>
          <li>
            <span class="import-step-title">Paste Claude’s answer here</span>
            <textarea class="import-text" rows="6" placeholder="Paste the whole answer — I’ll find the board in it." spellcheck="false"></textarea>
            <label class="import-file">or choose a file (.json or .txt)<input type="file" accept=".json,.txt,application/json,text/plain"></label>
            <p class="import-error" hidden></p>
          </li>
        </ol>
        <div class="dialog-buttons">
          <button class="dialog-btn" data-action="cancel">Cancel</button>
          <button class="dialog-btn primary" data-action="import">Import</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const box = el.querySelector('.dialog');
    const text = el.querySelector('.import-text');
    const errorBox = el.querySelector('.import-error');

    const values = () => ({
      topic: el.querySelector('[data-k="topic"]').value.trim(),
      level: el.querySelector('[data-k="level"]').value.trim(),
      pictures: el.querySelector('[data-k="pictures"]').checked,
    });

    async function copy() {
      const v = values();
      try { localStorage.setItem(REMEMBER, JSON.stringify(v)); } catch { /* ignore */ }
      const prompt = claudePrompt(v.topic, v.level, v.pictures);
      try {
        await navigator.clipboard.writeText(prompt);
        toast(`${ICONS.check} Prompt copied: paste it into Claude`, 2600);
      } catch {
        // No clipboard access: show the prompt so it can be copied by hand.
        text.value = prompt;
        text.select();
        toast('Press Ctrl+C to copy the prompt, then clear the box', 4000);
      }
    }

    function tryImport() {
      const { raw, error } = parseBoardText(text.value);
      if (error) {
        errorBox.hidden = false;
        errorBox.innerHTML = `${ICONS.warning} ${esc(error)}`;
        return;
      }
      done(raw);
    }

    const popKeys = pushKeys(e => {
      if (e.key === 'Escape') done(null);
      return true;
    });
    function done(result) {
      popKeys();
      el.remove();
      resolve(result);
    }

    el.addEventListener('click', e => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'copy') copy();
      if (a === 'import') tryImport();
      if (a === 'cancel' || e.target === el) done(null);
    });
    el.querySelector('input[type="file"]').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (f) text.value = await f.text();
      errorBox.hidden = true;
    });
    text.addEventListener('input', () => { errorBox.hidden = true; });
    box.querySelector('[data-k="topic"]').focus();
  });
}
