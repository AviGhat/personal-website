/* ==========================================================
   The telescope at the back of the cockpit: look through the
   eyepiece at the planets the ship can't land on. Each one is
   drawn on a round field of stars, with a reticle and a short
   survey note. Prev / Next (or the list, or the arrow keys)
   swing the scope from one to the next.
   ========================================================== */

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();

const BODIES = [
  { key: 'mercury', name: 'Mercury', dist: '0.6 AU', note: 'Smallest of the eight and closest to the sun. A cratered rock with almost no air to hold the heat.' },
  { key: 'venus', name: 'Venus', dist: '0.3 AU', note: 'Wrapped in thick sulphur cloud. Hotter at the surface than Mercury, for all its distance.' },
  { key: 'jupiter', name: 'Jupiter', dist: '4.2 AU', note: 'The giant. Banded cloud belts and a storm wider than Earth that has been turning for centuries.' },
  { key: 'saturn', name: 'Saturn', dist: '8.5 AU', note: 'Rings of ice and rock, hundreds of thousands of kilometres across and only metres thick.' },
  { key: 'uranus', name: 'Uranus', dist: '18 AU', note: 'An ice giant rolled on its side, so its poles take turns facing the sun.' },
  { key: 'neptune', name: 'Neptune', dist: '29 AU', note: 'Deep blue and the windiest of the lot. Out here the sun is just a bright star.' },
];

export function createScope(panel) {
  const canvas = panel.querySelector('[data-scope-view]');
  const g = canvas.getContext('2d');
  const nameEl = panel.querySelector('[data-scope-name]');
  const distEl = panel.querySelector('[data-scope-dist]');
  const noteEl = panel.querySelector('[data-scope-note]');
  const list = panel.querySelector('[data-scope-list]');
  let at = 2;   // start on Jupiter
  let raf = 0, slew = 0;

  // Chips for each body
  BODIES.forEach((b, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scope__chip';
    btn.textContent = b.name;
    btn.addEventListener('click', () => go(i));
    li.append(btn);
    list.append(li);
  });
  const chips = [...list.querySelectorAll('button')];

  function paint() {
    const b = BODIES[at];
    nameEl.textContent = b.name;
    distEl.textContent = `DIST ${b.dist}`;
    noteEl.textContent = b.note;
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === at)));
  }
  function go(i) {
    at = (i + BODIES.length) % BODIES.length;
    slew = 1;   // the view swings across to the new target
    paint();
  }

  // Stars fixed per session so the field doesn't flicker between frames
  const stars = Array.from({ length: 90 }, () => [Math.random(), Math.random(), Math.random()]);

  function disc(cx, cy, r, base, bands) {
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.fillStyle = token(base); g.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (bands) bands(cx, cy, r);
    // Terminator: the night side in shadow
    g.fillStyle = token('--space-black'); g.globalAlpha = 0.5;
    g.beginPath(); g.arc(cx + r * 0.55, cy, r * 1.05, 0, Math.PI * 2); g.fill();
    g.restore();
    g.globalAlpha = 1;
  }

  function draw(t) {
    const W = canvas.width, c = W / 2, s = t / 1000;
    slew = Math.max(0, slew - 0.04);
    g.fillStyle = token('--space-black'); g.fillRect(0, 0, W, W);
    const dx = slew * W * 0.6;
    stars.forEach(([x, y, k]) => {
      g.fillStyle = token(k > 0.8 ? '--cream' : '--ink-dim');
      g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(s * (0.5 + k) + k * 9));
      g.fillRect(((x * W + dx) % W + W) % W, y * W, k > 0.9 ? 2 : 1, k > 0.9 ? 2 : 1);
    });
    g.globalAlpha = 1;
    const cx = c + dx, cy = c, r = W * 0.26, key = BODIES[at].key, spin = s * 8;
    if (key === 'mercury') disc(cx, cy, r * 0.6, '--stone', (x, y, rr) => {
      g.fillStyle = token('--hull-dark');
      [[-0.3, -0.2, 0.18], [0.2, 0.3, 0.12], [-0.1, 0.4, 0.1], [0.35, -0.35, 0.09]].forEach(([u, v, k]) => { g.beginPath(); g.arc(x + u * rr, y + v * rr, k * rr, 0, Math.PI * 2); g.fill(); });
    });
    if (key === 'venus') disc(cx, cy, r * 0.8, '--lamp-shade', (x, y, rr) => {
      g.fillStyle = token('--cream'); g.globalAlpha = 0.35;
      for (let k = -3; k <= 3; k++) g.fillRect(x - rr, y + k * rr * 0.28 + Math.sin(s + k) * 4, rr * 2, rr * 0.12);
      g.globalAlpha = 1;
    });
    if (key === 'jupiter') disc(cx, cy, r, '--lamp-shade', (x, y, rr) => {
      const belts = ['--mars-dust', '--cream', '--couch-shade', '--cream', '--mars-dust', '--bark'];
      belts.forEach((b, k) => { g.fillStyle = token(b); g.fillRect(x - rr, y - rr + k * rr * 0.34, rr * 2, rr * 0.2); });
      g.fillStyle = token('--bebop-red');
      g.beginPath(); g.ellipse(x - rr * 0.3 + ((spin % (rr * 2)) - rr) * 0.3, y + rr * 0.3, rr * 0.2, rr * 0.11, 0, 0, Math.PI * 2); g.fill();
    });
    if (key === 'saturn') {
      const ring = () => { g.strokeStyle = token('--lamp-shade'); g.lineWidth = 6; g.beginPath(); g.ellipse(cx, cy, r * 1.6, r * 0.42, -0.25, 0, Math.PI * 2); g.stroke(); g.strokeStyle = token('--mars-dust'); g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, r * 1.35, r * 0.34, -0.25, 0, Math.PI * 2); g.stroke(); };
      ring();
      disc(cx, cy, r * 0.8, '--amber', (x, y, rr) => { g.fillStyle = token('--lamp-shade'); for (let k = -2; k <= 2; k++) g.fillRect(x - rr, y + k * rr * 0.36, rr * 2, rr * 0.14); });
      // The near half of the ring passes in front of the planet
      g.save(); g.beginPath(); g.rect(0, cy, W, W); g.clip(); ring(); g.restore();
    }
    if (key === 'uranus') {
      disc(cx, cy, r * 0.7, '--atmo');
      g.strokeStyle = token('--atmo'); g.globalAlpha = 0.5; g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, cy, r * 0.25, r * 1.1, 0.15, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    if (key === 'neptune') disc(cx, cy, r * 0.7, '--earth-ocean', (x, y, rr) => {
      g.fillStyle = token('--earth-deep'); g.beginPath(); g.ellipse(x - rr * 0.2, y + rr * 0.15, rr * 0.22, rr * 0.12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = token('--cream'); g.globalAlpha = 0.5; g.fillRect(x - rr * 0.5, y - rr * 0.3, rr * 0.4, 2); g.globalAlpha = 1;
    });
    // Reticle and the round eyepiece mask
    g.strokeStyle = token('--neon'); g.globalAlpha = 0.5; g.lineWidth = 1;
    g.beginPath(); g.moveTo(c, 12); g.lineTo(c, c - 20); g.moveTo(c, c + 20); g.lineTo(c, W - 12); g.moveTo(12, c); g.lineTo(c - 20, c); g.moveTo(c + 20, c); g.lineTo(W - 12, c); g.stroke();
    g.beginPath(); g.arc(c, c, W * 0.42, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = token('--soot');
    g.beginPath(); g.rect(0, 0, W, W); g.arc(c, c, W * 0.48, 0, Math.PI * 2, true); g.fill('evenodd');
    g.fillStyle = token('--neon'); g.font = '16px VT323, monospace';
    g.fillText(`${BODIES[at].name.toUpperCase()}  ${BODIES[at].dist}`, 14, W - 14);
  }
  const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };

  panel.querySelector('[data-scope-prev]').addEventListener('click', () => go(at - 1));
  panel.querySelector('[data-scope-next]').addEventListener('click', () => go(at + 1));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
  });
  paint();

  return {
    show() {
      panel.hidden = false;
      panel.classList.remove('is-open');
      void panel.offsetWidth;
      panel.classList.add('is-open');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      panel.focus({ preventScroll: true });
    },
    hide() { panel.hidden = true; cancelAnimationFrame(raf); },
  };
}
