// Confetti for celebrations — reusable by any classroom game.
//
//   const stop = confetti(container, { colors: [...] });   // returns a function that stops it
//
// Pieces come in several shapes (strips, circles, triangles, stars) so it reads as a party, not just color.

export function confetti(container, { colors = ['#FFD24A', '#ffffff', '#4FC3F7', '#F06292', '#B2FF59', '#FF8A50'], burst = 220, trickle = 3 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const shapes = ['strip', 'circle', 'triangle', 'star'];
  let pieces = [];
  let running = true;
  let frame = null;

  function resize() {
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
  }
  resize();
  addEventListener('resize', resize);

  function add(fromCannon) {
    const W = canvas.width, H = canvas.height;
    const size = (8 + Math.random() * 14) * devicePixelRatio * (W / 1920 + .4);
    const left = Math.random() < .5;
    pieces.push({
      x: fromCannon ? (left ? 0 : W) : Math.random() * W,
      y: fromCannon ? H * .75 : -size * 2,
      vx: fromCannon ? (left ? 1 : -1) * (6 + Math.random() * 14) * devicePixelRatio : (Math.random() - .5) * 2,
      vy: fromCannon ? -(14 + Math.random() * 16) * devicePixelRatio : 2 + Math.random() * 3,
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      spin: (Math.random() - .5) * .3,
      angle: Math.random() * Math.PI * 2,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  for (let i = 0; i < burst; i++) add(true);

  function draw(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(1, Math.cos(p.wobble)); // flipping in the air
    ctx.fillStyle = p.color;
    const s = p.size;
    ctx.beginPath();
    if (p.shape === 'strip') ctx.rect(-s / 2, -s / 5, s, s / 2.5);
    else if (p.shape === 'circle') ctx.arc(0, 0, s / 2.6, 0, Math.PI * 2);
    else if (p.shape === 'triangle') { ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.lineTo(-s / 2, s / 2); }
    else {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s / 4.5 : s / 2;
        const a = (i / 10) * Math.PI * 2;
        ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (running) for (let i = 0; i < trickle; i++) add(false);
    const g = .35 * devicePixelRatio;
    pieces = pieces.filter(p => p.y < canvas.height + 60);
    for (const p of pieces) {
      p.vy = Math.min(p.vy + g, 6 * devicePixelRatio);
      p.vx *= .985;
      p.x += p.vx + Math.sin(p.wobble) * .8;
      p.y += p.vy;
      p.angle += p.spin;
      p.wobble += .12;
      draw(p);
    }
    if (running || pieces.length) frame = requestAnimationFrame(tick);
    else canvas.remove();
  }
  tick();

  return function stop() {
    running = false;
    removeEventListener('resize', resize);
    cancelAnimationFrame(frame);
    canvas.remove();
  };
}
