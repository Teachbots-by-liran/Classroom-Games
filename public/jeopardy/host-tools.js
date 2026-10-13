// Tools the host uses on every game screen (board, questions, Final Round):
// the countdown timer with its sounds and TIME'S UP banner, and the sound on/off switch.

import { ICONS } from '../shared/icons.js';
import { CountdownTimer } from '../shared/timer.js';
import { sound } from '../shared/sound.js';
import { toast } from '../shared/toast.js';

export const WARN_SECONDS = 5;

export function createGameTimer(seconds) {
  return new CountdownTimer(seconds, {
    onSecond: s => sound.play(s <= WARN_SECONDS ? 'tickLoud' : 'tick'),
    onEnd: timesUp,
  });
}

function timesUp() {
  sound.play('timeUp');
  const banner = document.createElement('div');
  banner.className = 'times-up';
  banner.innerHTML = `<div class="times-up-inner">${ICONS.timer}<span>TIME'S UP!</span></div>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2200);
}

// Sound on/off with a short message. Returns true if sound is now off.
export function toggleSound() {
  const muted = sound.toggleMute();
  toast(muted ? `${ICONS.muted} Sound off` : `${ICONS.sound} Sound on`, 1400);
  return muted;
}
