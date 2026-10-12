// Game-show sounds made by the browser itself (no audio files, no internet). Reusable by any classroom game.
//
//   sound.play('correct')     sound.toggleMute()     sound.muted
//
// The mute setting is remembered between lessons and shared by all the games.

const MUTE_KEY = 'classroom-games-muted';
let ctx = null;
let master = null;
let muted = readMuted();

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

// Browsers only allow sound after the first click or key press, so the audio starts then.
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const limiter = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(limiter).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio(), { capture: true });

// One note: a wave that fades in and out, optionally sliding to another pitch.
function tone({ freq, type = 'sine', at = 0, dur = .2, vol = .3, slideTo = null, attack = .01 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + .05);
}

// A burst of filtered noise: whooshes and swishes.
function noise({ at = 0, dur = .3, vol = .2, from = 400, to = 4000, q = 1.2 }) {
  const t = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + dur * .3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

const notes = (list, opts) => list.forEach(([freq, at, dur = .25]) => tone({ freq, at, dur, ...opts }));

const SOUNDS = {
  // A tile flips open: whoosh up + bright ping
  open() {
    noise({ dur: .35, vol: .25, from: 300, to: 5000 });
    tone({ freq: 1320, type: 'triangle', at: .22, dur: .4, vol: .18 });
  },
  // A question closes: whoosh down
  close() {
    noise({ dur: .3, vol: .18, from: 4000, to: 300 });
  },
  // Answer revealed: rising "ta-da"
  reveal() {
    notes([[523, 0], [659, .08], [784, .16], [1047, .24, .5]], { type: 'triangle', vol: .22 });
  },
  // Points given: two bright bells
  correct() {
    notes([[988, 0, .3], [1319, .1, .6]], { type: 'sine', vol: .3 });
    notes([[1976, 0, .2], [2637, .1, .3]], { type: 'sine', vol: .06 });
  },
  // Points taken: low falling buzz
  wrong() {
    tone({ freq: 150, slideTo: 85, type: 'sawtooth', dur: .5, vol: .2 });
    tone({ freq: 155, slideTo: 88, type: 'square', dur: .5, vol: .08 });
  },
  // A multiple-choice option is crossed out
  out() {
    tone({ freq: 220, slideTo: 110, type: 'square', dur: .18, vol: .12 });
  },
  // Quiet clock tick each second, louder in the last seconds
  tick() {
    tone({ freq: 1800, type: 'square', dur: .03, vol: .04, attack: .002 });
  },
  tickLoud() {
    tone({ freq: 1400, type: 'square', dur: .07, vol: .2, attack: .002 });
    tone({ freq: 700, type: 'sine', dur: .12, vol: .2, attack: .002 });
  },
  // Time's up: long game-show buzzer
  timeUp() {
    tone({ freq: 196, type: 'square', dur: 1.1, vol: .16, attack: .02 });
    tone({ freq: 201, type: 'sawtooth', dur: 1.1, vol: .12, attack: .02 });
    tone({ freq: 98, type: 'sine', dur: 1.1, vol: .25, attack: .02 });
  },
  // Undo: little blip downwards
  undo() {
    tone({ freq: 880, slideTo: 440, type: 'triangle', dur: .18, vol: .18 });
  },
  // Turn passes to another team
  turn() {
    tone({ freq: 660, type: 'triangle', dur: .12, vol: .12 });
    tone({ freq: 880, type: 'triangle', at: .07, dur: .15, vol: .12 });
  },
  // Sound switched back on
  on() {
    notes([[660, 0, .12], [990, .08, .2]], { type: 'triangle', vol: .2 });
  },
  // Big reveal sting (Daily Double): rising sweep, then a chord hit
  sting() {
    noise({ dur: .6, vol: .25, from: 200, to: 6000 });
    tone({ freq: 110, slideTo: 440, type: 'sawtooth', dur: .6, vol: .12 });
    notes([[523, .6, 1.2], [659, .6, 1.2], [784, .6, 1.2], [1047, .6, 1.2]], { type: 'sawtooth', vol: .07 });
    notes([[523, .6, 1.2], [784, .6, 1.2], [1047, .6, 1.4]], { type: 'triangle', vol: .15 });
  },
  // Winner fanfare
  fanfare() {
    const n = [[523, 0, .18], [523, .18, .18], [523, .36, .18], [659, .54, .5], [784, 1.04, .25], [659, 1.29, .2], [784, 1.49, 1]];
    notes(n, { type: 'sawtooth', vol: .08 });
    notes(n, { type: 'triangle', vol: .2 });
    notes([[262, .54, .5], [392, 1.49, 1]], { type: 'sine', vol: .25 });
  },
};

export const sound = {
  get muted() { return muted; },

  play(name) {
    if (muted || !SOUNDS[name]) return;
    if (!audio()) return;
    try { SOUNDS[name](); } catch { /* never let a sound problem stop the game */ }
  },

  toggleMute() {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    if (!muted) this.play('on');
    return muted;
  },
};
