// Countdown timer — reusable by any classroom game.
//
//   const timer = new CountdownTimer(30, { onSecond, onEnd });
//   timer.start() / pause() / toggle() / reset()
//   timerDisplay(element, timer)  draws a ring + number that updates by itself.
//
// Needs /shared/timer.css on the page.

import { ICONS } from './icons.js';

export class CountdownTimer {
  // onSecond(secondsLeft) runs each time the displayed number changes while running.
  // onEnd() runs when the countdown reaches zero.
  constructor(seconds, { onSecond = null, onEnd = null } = {}) {
    this.total = seconds;
    this.left = seconds * 1000;
    this.running = false;
    this.onSecond = onSecond;
    this.onEnd = onEnd;
    this.listeners = new Set();
    this.frame = null;
    this.lastShown = seconds;
  }

  get secondsLeft() { return Math.ceil(this.left / 1000); }
  get done() { return this.left <= 0; }

  // Listen for changes (many times per second while running). Returns a function that stops listening.
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach(fn => fn(this));
  }

  start() {
    if (this.running) return;
    if (this.done) this.left = this.total * 1000;
    this.running = true;
    this.endAt = performance.now() + this.left;
    this.lastShown = this.secondsLeft;
    this.loop();
  }

  pause() {
    if (!this.running) return;
    this.left = Math.max(0, this.endAt - performance.now());
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.emit();
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  reset(seconds = this.total) {
    cancelAnimationFrame(this.frame);
    this.total = seconds;
    this.left = seconds * 1000;
    this.running = false;
    this.lastShown = seconds;
    this.emit();
  }

  loop() {
    this.left = Math.max(0, this.endAt - performance.now());
    const shown = this.secondsLeft;
    if (shown !== this.lastShown) {
      this.lastShown = shown;
      if (shown > 0) this.onSecond?.(shown);
    }
    if (this.left <= 0) {
      this.running = false;
      this.emit();
      this.onEnd?.();
      return;
    }
    this.emit();
    this.frame = requestAnimationFrame(() => this.loop());
  }
}

const RING = 2 * Math.PI * 44;

// Draw a timer (ring + number) inside an element. Returns a function that stops updating it.
// The element gets classes: running, warning (last `warnAt` seconds), done, beat (restarts every second).
export function timerDisplay(el, timer, { warnAt = 5 } = {}) {
  el.classList.add('timer');
  el.innerHTML = `
    <span class="timer-face">
      <svg class="timer-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="timer-track" cx="50" cy="50" r="44"/>
        <circle class="timer-fill" cx="50" cy="50" r="44" stroke-dasharray="${RING}"/>
      </svg>
      <span class="timer-num"></span>
      <span class="timer-done-icon">${ICONS.timer}</span>
    </span>
    <span class="timer-state" aria-hidden="true">${ICONS.play}</span>`;
  const num = el.querySelector('.timer-num');
  const fill = el.querySelector('.timer-fill');
  let lastSecond = null;

  return timer.subscribe(t => {
    const s = t.secondsLeft;
    num.textContent = s;
    fill.style.strokeDashoffset = RING * (1 - t.left / (t.total * 1000));
    el.classList.toggle('running', t.running);
    el.classList.toggle('paused', !t.running && !t.done && t.left < t.total * 1000);
    el.classList.toggle('warning', !t.done && s <= warnAt && t.left < t.total * 1000);
    el.classList.toggle('done', t.done);
    el.setAttribute('aria-label', t.done ? "Time's up" : `${s} seconds left`);
    if (s !== lastSecond) {
      lastSecond = s;
      el.classList.remove('beat');
      void el.offsetWidth; // restart the once-per-second pulse
      if (t.running) el.classList.add('beat');
    }
  });
}
