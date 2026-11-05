/* ==========================================================
   The nav plot: opened by the red button on the dash (or by
   clicking a planet). Pick Earth or Mars; the radar shows the
   course, the readouts give the distance, and "Begin descent"
   takes the ship down to whichever planet is set.
   ========================================================== */

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();

const PLACES = {
  earth: { name: 'Earth', where: 'Pine camp / night', near: 'ALT 400 KM / ORBIT', far: '78,340,000 KM', orbit: 0.36, ink: '--earth-shallow', angle: 2.4 },
  mars: { name: 'Mars', where: 'Tijuana / dusk', near: 'ALT 400 KM / ORBIT', far: '78,340,000 KM', orbit: 0.48, ink: '--mars-dust', angle: 0.9 },
};
// The rest of the system: plotted for reference, no landing site (see them through the telescope)
const SURVEY = [
  { name: 'Mercury', orbit: 0.14, ink: '--stone', angle: 4.1, rate: 0.5 },
  { name: 'Venus', orbit: 0.25, ink: '--lamp-shade', angle: 5.3, rate: 0.35 },
  { name: 'Jupiter', orbit: 0.63, ink: '--amber', angle: 3.6, rate: 0.08 },
  { name: 'Saturn', orbit: 0.75, ink: '--lamp-shade', angle: 1.7, rate: 0.05 },
  { name: 'Uranus', orbit: 0.86, ink: '--atmo', angle: 5.9, rate: 0.03 },
  { name: 'Neptune', orbit: 0.95, ink: '--earth-ocean', angle: 0.3, rate: 0.02 },
];

export function createNav(panel, { onCourse, onGo }) {
  const canvas = panel.querySelector('[data-nav-radar]');
  const g = canvas.getContext('2d');
  const dests = [...panel.querySelectorAll('[data-dest]')];
  const goTo = panel.querySelector('[data-nav-go-to]');
  let course = 'earth';
  let raf = 0;

  function paint() {
    dests.forEach((b) => {
      const on = b.dataset.dest === course;
      b.setAttribute('aria-checked', String(on));
      panel.querySelector(`[data-dist="${b.dataset.dest}"]`).textContent = on ? PLACES[b.dataset.dest].near : PLACES[b.dataset.dest].far;
    });
    goTo.textContent = `to ${PLACES[course].name}`;
  }

  // The radar: the sun, two orbits, both planets, the ship and its course line
  function draw(t) {
    const W = canvas.width, c = W / 2, s = t / 1000;
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, W, W);
    g.strokeStyle = token('--neon'); g.globalAlpha = 0.25; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, c); g.lineTo(W, c); g.moveTo(c, 0); g.lineTo(c, W); g.stroke();
    [...Object.values(PLACES), ...SURVEY].forEach((p) => { g.beginPath(); g.arc(c, c, p.orbit * c, 0, Math.PI * 2); g.stroke(); });
    g.globalAlpha = 1;
    g.fillStyle = token('--amber'); g.beginPath(); g.arc(c, c, 6, 0, Math.PI * 2); g.fill();
    const at = (p) => [c + Math.cos(p.angle) * p.orbit * c, c + Math.sin(p.angle) * p.orbit * c];
    // Survey planets drift slowly round their orbits, dim, labelled small
    SURVEY.forEach((p) => {
      const a = p.angle + s * p.rate * 0.1;
      const x = c + Math.cos(a) * p.orbit * c, y = c + Math.sin(a) * p.orbit * c;
      g.fillStyle = token(p.ink); g.globalAlpha = 0.75;
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = token('--ink-dim'); g.font = '12px VT323, monospace';
      g.fillText(p.name.toUpperCase(), x + 6, y + 4);
      g.globalAlpha = 1;
    });
    const here = at(PLACES[course]);
    // The ship parked beside the set destination, with a dashed course from the other
    const other = at(PLACES[course === 'earth' ? 'mars' : 'earth']);
    g.setLineDash([4, 5]); g.strokeStyle = token('--bebop-red'); g.lineWidth = 2;
    g.beginPath(); g.moveTo(...other); g.lineTo(...here); g.stroke();
    g.setLineDash([]);
    Object.entries(PLACES).forEach(([key, p]) => {
      const [x, y] = at(p);
      g.fillStyle = token(p.ink); g.beginPath(); g.arc(x, y, key === course ? 8 : 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = token('--cream'); g.font = '15px VT323, monospace';
      g.fillText(p.name.toUpperCase(), x + 10, y - 8);
    });
    const blink = Math.floor(s * 2) % 2;
    g.fillStyle = token(blink ? '--neon' : '--cream');
    g.fillRect(here[0] - 3 - 12, here[1] - 3 + 12, 6, 6);
    // Sweep
    const sweep = (s * 1.2) % (Math.PI * 2);
    g.strokeStyle = token('--neon'); g.globalAlpha = 0.6; g.lineWidth = 2;
    g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(sweep) * c, c + Math.sin(sweep) * c); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = token('--neon'); g.font = '15px VT323, monospace';
    g.fillText('NAV / SOL SYSTEM', 8, 18);
  }
  const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };

  dests.forEach((b) => b.addEventListener('click', () => {
    if (course === b.dataset.dest) return;
    course = b.dataset.dest;
    paint();
    onCourse(course);
  }));
  panel.querySelector('[data-nav-go]').addEventListener('click', () => onGo(course));
  paint();

  return {
    show(pick) {
      if (pick && pick !== course) { course = pick; paint(); onCourse(course); }
      panel.hidden = false;
      panel.classList.remove('is-open');
      void panel.offsetWidth;
      panel.classList.add('is-open');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      panel.focus({ preventScroll: true });
    },
    hide() { panel.hidden = true; cancelAnimationFrame(raf); },
    get course() { return course; },
  };
}
