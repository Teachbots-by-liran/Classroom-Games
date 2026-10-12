// Simple line icons used across games. Each one is an inline SVG that takes the text color.

const line = (body, width = 2.4) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  timer:   line('<circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4.5l3 2M9.5 2.5h5"/>'),
  sound:   line('<path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13"/>'),
  muted:   line('<path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  help:    line('<path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5"/><circle cx="12" cy="19" r=".6" fill="currentColor"/>', 2.6),
  check:   line('<path d="M4.5 12.5l5 5L19.5 7"/>', 3.4),
  close:   line('<path d="M6 6l12 12M18 6L6 18"/>', 3),
  plus:    line('<path d="M12 5v14M5 12h14"/>', 3),
  play:    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>',
  dice:    line('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'),
  flag:    line('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  undo:    line('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', 2.8),
  eye:     line('<path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>'),
  exit:    line('<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'),
  warning: line('<path d="M12 3l10 18H2z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/>'),
};
