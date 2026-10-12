// Reads Jeopardy board files from the /boards folder and checks them for mistakes.
// Every problem is described in plain words so a teacher can fix the file without help.

const MAX_CATEGORIES = 6;
const MAX_QUESTIONS = 5;

// The list of boards for the setup menu.
export async function listBoards() {
  const res = await fetch('/api/jeopardy/boards');
  if (!res.ok) throw new Error('Could not read the boards folder.');
  return res.json();
}

// Load one board file. Returns { board, problems }. If problems is not empty, the board can't be played.
export async function loadBoard(file) {
  const res = await fetch('/boards/' + encodeURIComponent(file), { cache: 'no-store' });
  if (!res.ok) return { board: null, problems: [`The file "${file}" could not be opened.`] };
  const text = await res.text();

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { board: null, problems: [describeJsonError(text, err)] };
  }

  const { board, problems } = checkBoard(raw, file);
  if (board) problems.push(...await findMissingPictures(board));
  return { board, problems };
}

// Turn a JSON syntax error into "Line 12: ..." with a hint about the usual causes.
function describeJsonError(text, err) {
  const msg = err.message || '';
  let line = null;
  const lineMatch = msg.match(/line (\d+)/i);
  const posMatch = msg.match(/position (\d+)/i);
  if (lineMatch) line = Number(lineMatch[1]);
  else if (posMatch) line = text.slice(0, Number(posMatch[1])).split('\n').length;
  const where = line ? `Line ${line}: ` : '';
  return `${where}the file has a typing mistake, so it can't be read. ` +
    'Check for a missing comma between items, an extra comma before } or ], or a missing quote mark (").';
}

// Check the board's structure and fill in defaults. Returns { board, problems }.
export function checkBoard(raw, file) {
  const problems = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { board: null, problems: ['The file should start with { and end with }.'] };
  }

  const cats = raw.categories;
  if (!Array.isArray(cats) || cats.length === 0) {
    return { board: null, problems: ['The board needs a "categories" list.'] };
  }
  if (cats.length > MAX_CATEGORIES) {
    problems.push(`The board has ${cats.length} categories. The most it can show is ${MAX_CATEGORIES}.`);
  }

  const categories = cats.slice(0, MAX_CATEGORIES).map((cat, c) => {
    const where = `Category ${c + 1}`;
    if (!cat || typeof cat !== 'object') {
      problems.push(`${where} is not written correctly.`);
      return { name: '?', questions: [] };
    }
    if (!text(cat.name)) problems.push(`${where} has no "name".`);
    const qs = Array.isArray(cat.questions) ? cat.questions : [];
    if (qs.length === 0) problems.push(`${where} ("${cat.name || ''}") has no questions.`);
    if (qs.length > MAX_QUESTIONS) problems.push(`${where} has ${qs.length} questions. The most is ${MAX_QUESTIONS}.`);

    return {
      name: text(cat.name),
      questions: qs.slice(0, MAX_QUESTIONS).map((q, r) => {
        const qWhere = `${where}, question ${r + 1}`;
        q = q && typeof q === 'object' ? q : {};
        if (!text(q.question) && !text(q.image) && !text(q.quote)) {
          problems.push(`${qWhere} needs a "question", an "image" or a "quote".`);
        }
        if (!text(q.answer) && !text(q.answerImage)) problems.push(`${qWhere} has no "answer".`);
        const points = q.points === undefined ? (r + 1) * 100 : Number(q.points);
        if (!Number.isFinite(points) || points <= 0) problems.push(`${qWhere}: "points" must be a number like 300.`);
        return {
          points,
          question: text(q.question),
          quote: text(q.quote),
          image: picturePath(q.image),
          answer: text(q.answer),
          answerImage: picturePath(q.answerImage),
          explain: text(q.explain),
        };
      }),
    };
  });

  const timerSeconds = raw.timerSeconds === undefined ? 30 : Number(raw.timerSeconds);
  if (!Number.isFinite(timerSeconds) || timerSeconds < 5 || timerSeconds > 600) {
    problems.push('"timerSeconds" must be a number between 5 and 600.');
  }

  let final = null;
  if (raw.final) {
    const f = raw.final;
    if (!text(f.question) && !text(f.image) && !text(f.quote)) problems.push('The Final Round needs a "question".');
    if (!text(f.answer)) problems.push('The Final Round has no "answer".');
    final = {
      category: text(f.category) || 'Final Round',
      question: text(f.question),
      quote: text(f.quote),
      image: picturePath(f.image),
      answer: text(f.answer),
      answerImage: picturePath(f.answerImage),
      explain: text(f.explain),
    };
  }

  // "random" (default), "none", or a fixed tile like { "category": 2, "question": 4 } (counting from 1).
  let dailyDouble = 'random';
  const dd = raw.dailyDouble;
  if (dd === 'none' || dd === false) dailyDouble = 'none';
  else if (dd && typeof dd === 'object') {
    const c = Number(dd.category) - 1;
    const r = Number(dd.question) - 1;
    if (categories[c] && categories[c].questions[r]) dailyDouble = { category: c, question: r };
    else problems.push('"dailyDouble" points to a tile that does not exist.');
  }

  return {
    board: {
      file,
      title: text(raw.title) || file.replace(/\.json$/i, ''),
      timerSeconds: Number.isFinite(timerSeconds) ? timerSeconds : 30,
      categories,
      dailyDouble,
      final,
    },
    problems,
  };
}

function text(value) {
  return typeof value === 'string' ? value.trim() : (typeof value === 'number' ? String(value) : '');
}

// Picture paths in board files are relative to the boards folder ("images/cat.png").
function picturePath(value) {
  const p = text(value);
  if (!p) return '';
  if (/^(https?:|data:|\/)/i.test(p)) return p;
  return '/boards/' + p.split('/').map(encodeURIComponent).join('/');
}

// Ask the server for every picture once, and report the ones that are missing.
async function findMissingPictures(board) {
  const checks = [];
  board.categories.forEach((cat, c) => cat.questions.forEach((q, r) => {
    for (const key of ['image', 'answerImage']) {
      if (q[key]) checks.push({ src: q[key], where: `Category ${c + 1}, question ${r + 1}` });
    }
  }));
  if (board.final) {
    for (const key of ['image', 'answerImage']) {
      if (board.final[key]) checks.push({ src: board.final[key], where: 'Final Round' });
    }
  }
  const results = await Promise.all(checks.map(async ch => {
    if (/^(https?:|data:)/i.test(ch.src)) return null;
    try {
      const res = await fetch(ch.src, { method: 'HEAD' });
      return res.ok ? null : ch;
    } catch {
      return ch;
    }
  }));
  return results.filter(Boolean).map(ch =>
    `${ch.where}: picture not found (${decodeURIComponent(ch.src.replace('/boards/', ''))}). Check the file name and that it's in the boards/images folder.`);
}
