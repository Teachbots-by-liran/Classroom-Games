# Jeopardy — Teacher's Guide

A game-show quiz for the classroom projector. Students play in teams and answer out loud;
you run everything from your laptop. No internet needed.

---

## 1. Starting the game

1. Open a terminal in the `Classroom-Games` folder and type `npm start`
   (the same way you start Codenames).
2. Open **http://localhost:3000** in Chrome or Edge and click **Jeopardy**.
3. Choose a board, name your teams (2–6), choose who picks first, and press **START GAME**.
   The game switches to full screen. Press **F** if it ever leaves full screen.

If the page is refreshed by accident, the game comes back exactly where it was.

---

## 2. Making a new board — three ways

### A. Let Claude write it (fastest)

1. On the setup screen press **+ New board**, then **Import**.
2. Type the **topic** and your **students** (e.g. "Food and cooking", "Grade 10, B1").
3. Press **Copy prompt for Claude**, paste it into Claude (claude.ai) and send it.
4. Copy Claude's whole answer, paste it into the box, press **Import**.
5. Check the questions, add pictures where you like, and press **SAVE**.

Tiles with a **dashed picture icon** have a picture idea from Claude (e.g. "a wooden spoon").
The idea is shown inside the empty picture box so you know what to look for. Pictures are optional.

### B. Use the board editor

On the setup screen press **+ New board**, or the **✎** button next to any board.

- Type the category names straight into the top row.
- Click a tile to fill it in on the right: question, picture, quote, answer or multiple choice,
  explanation.
- Tiles show what's left: **✓** finished · **+** empty · **⚠** needs fixing.
- **Final Round** and **Settings** (timer, Daily Double) are under the grid.
- Press **SAVE**. You can save an unfinished board and come back later.

Pictures: press **Choose picture** or drag a picture from your computer onto the picture box.
It is copied into the `boards/images` folder for you.

### C. Write the file by hand

Every board is one text file in the **`boards`** folder, ending in `.json`.
The easiest start: copy one of the sample boards, rename it, and change the text.
Open it with Notepad (or any text editor). The format is explained below.

---

## 3. The board file

```json
{
  "title": "Unit 3: Food",
  "timerSeconds": 30,
  "dailyDouble": "random",
  "categories": [
    {
      "name": "In the Kitchen",
      "questions": [
        { "question": "What is this?", "image": "images/food/kettle.png", "answer": "a kettle" },
        { "question": "Never ___! Keep trying!", "choices": ["give in", "give up", "give out"], "answer": "give up" },
        { "question": "Who wrote this?", "quote": "To be, or not to be", "answer": "Shakespeare", "explain": "Hamlet, 1600" },
        { "question": "What is the past simple of GO?", "answer": "went" },
        { "question": "True or false? Rice is countable.", "choices": ["True", "False"], "answer": "False" }
      ]
    }
  ],
  "final": { "category": "Word Building", "question": "Make a noun from DECIDE.", "answer": "decision" }
}
```

### Board settings

| Line | What it does |
|---|---|
| `"title"` | The board's name in the menu. |
| `"timerSeconds"` | How long the timer runs (5–600). Optional; 30 if left out. |
| `"dailyDouble"` | `"random"` (a random 300–500 tile), `"none"`, or a fixed tile: `{ "category": 2, "question": 4 }` (counting from 1). |
| `"categories"` | Up to 6 categories, each with a `"name"` and up to 5 `"questions"` (100 to 500 points, top to bottom). |
| `"final"` | The Final Round: `"category"`, `"question"`, `"answer"`. Leave it out for no Final Round. |

### What a question can have

| Part | Needed? | What it does |
|---|---|---|
| `"question"` | yes* | The question text. Keep it short: about 15 words. |
| `"answer"` | yes | The answer. For multiple choice: the right choice's text, or its letter (`"B"`). |
| `"image"` | optional | A picture, e.g. `"images/food/kettle.png"`. Put the picture inside the `boards/images` folder. |
| `"quote"` | optional | A quotation, shown big with quote marks. |
| `"choices"` | optional | Makes it multiple choice: a list of 2–6 options, e.g. `["cat", "dog", "bird"]`. |
| `"explain"` | optional | A short note shown under the answer (a meaning, a rule, a source). |
| `"points"` | optional | Normally 100–500 by position. Write a number to change it. |
| `"answerImage"` | optional | A picture shown together with the answer. |
| `"imageIdea"` | optional | A note for you: which picture to find. Not shown to students. |

\* A question needs at least one of `"question"`, `"image"` or `"quote"`.

### Typing rules (the usual mistakes)

- Every text goes in **straight double quotes**: `"like this"` — not `“curly”` quotes and not `'single'`.
- Put a **comma between items**, but **not after the last one** before `}` or `]`.
- Inside a text, write a double quote as `\"`, e.g. `"question": "What does \"spill the beans\" mean?"`.
- Picture names must match exactly, including `.png` / `.jpg`.

Don't worry about breaking anything: if a board has a mistake, the setup screen shows a ⚠
and says what's wrong and where (e.g. *"Category 2, question 3 has no answer"*), and the game
won't start until it's fixed.

---

## 4. Running the game

### On the board
Click a tile to open it. The **PICK** tag shows whose turn it is; it moves on after each question.
Click a team (or press its number) to give them the turn instead.

### On a question
- **A** shows the answer.
- **1–6** (or the team's ✓ button): correct, give points. **Shift + 1–6** (or ✗): wrong, take points.
- Multiple choice: click the choice a team calls out. Wrong ones are crossed out; the right one lights up.
- **Esc** goes back to the board (the tile is used). **Backspace** puts the tile back unplayed.

### Daily Double
One hidden tile. The team whose turn it is bets (another team: click it or press **T**).
Type the bet, use ↑ / ↓, or **All in**, then **Enter**. Teams can bet up to their score,
or up to 500 if their score is lower. Only the betting team can win or lose.

### Final Round
Starts by itself after the last tile (or use the door button ⇦ → *Go to the Final Round*).
Teams write a secret bet on paper; you type the bets (they show as dots). Then mark each team
right ✓ or wrong ✗ and press **Winners**.

### Keys at any time
| Key | Action |
|---|---|
| Space | Start / pause the timer |
| R | Reset the timer |
| U | Undo the last score change |
| M | Sound on / off |
| F | Full screen on / off |
| ? | Show all keys |

---

## 5. Good to know

- **Ending early:** the door button ⇦ on the board → Final Round, Winners, or New game.
- **Next lesson:** a game from earlier is offered as **Continue last game** on the setup screen.
- **Team names** are remembered for next time.
- **Pictures:** PNG, JPG, GIF, WEBP or SVG. Landscape pictures fill the space best.
- **Backing up:** your boards and pictures are all in the `boards` folder. Copy that folder to keep them safe.
- **Online version** (https://classroom-games-teach-bots.vercel.app/jeopardy): you can import, make and
  save boards there too, but they are saved **in that browser on that computer only** (marked
  *This browser* in the board list). To use one on another computer, press **Download** in the editor,
  then on the other computer: **+ New board → Import → choose the file**. Pictures travel inside the file.
  If the browser's history and site data are cleared, browser boards are gone, so keep the downloaded file.
  To delete a browser board: open it in the editor → **Settings** → **Delete this board**.
