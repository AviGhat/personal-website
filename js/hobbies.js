import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildWorld } from './lounge-world.js';
import { buildCockpit, buildHyperspace, THRUST_DEFAULT } from './cockpit.js';
import { createTape } from './tape.js';
import { createFighter } from './fighter.js';
import { buildCabinet } from './arcade.js';

/* ==========================================================
   Off Duty: a ship's lounge with four CRT monitors, and a
   cockpit up the stairs.
   Click a monitor (or a channel button) and the camera flies in,
   then a terminal opens over the screen with that hobby. Click the
   door at the top of the stairs to climb into the pilot's seat,
   where the console monitor opens the pilot file (about me) and the
   tape deck projects a player for the Spotify playlist. Back in the
   lounge, the arcade cabinet plays Dock 9 Brawl.
   ========================================================== */

const root = document.documentElement;
const css = getComputedStyle(root);
const token = (name) => css.getPropertyValue(name).trim();
const color = (name) => new THREE.Color(token(name));
const motion = () => root.classList.contains('fx-on');
const sound = (name) => {
  try { if (window.agSound && window.agSound[name]) window.agSound[name](); } catch (e) { /* sound is a nicety; never let it break the scene */ }
};

const stage = document.querySelector('[data-stage]');
const lounge = document.querySelector('.lounge');
const tv = document.querySelector('[data-tv]');
const tvLabel = tv.querySelector('[data-tv-label]');
const hobbies = [...tv.querySelectorAll('[data-hobby]')];
const chButtons = [...document.querySelectorAll('[data-channel]')];
const deckButtons = [...document.querySelectorAll('[data-deck]')];
const pilotButtons = [...document.querySelectorAll('[data-pilot]')];
const tapeButtons = [...document.querySelectorAll('[data-tape]')];
const holo = document.querySelector('[data-holo]');
const tape = createTape(holo);
const cabPanel = document.querySelector('[data-cab]');
const game = createFighter(cabPanel.querySelector('[data-cab-canvas]'));
const hint = document.querySelector('[data-hint]');
const ABOUT = 4;   // the pilot file is the fifth terminal
const DECK = 5;    // the tape deck's holo player; ABOUT and DECK live in the cockpit
const ARCADE = 6;  // the lounge arcade cabinet
const onBridge = (i) => i === ABOUT || i === DECK;
const chButton = (i) => chButtons.find((b) => Number(b.dataset.channel) === i);

/* ---------- Throttle: the lever, the Thrust slider and the keys all set this ---------- */

const thrustInput = document.querySelector('[data-thrust]');
const thrustNum = document.querySelector('[data-thrust-num]');
let thrust = THRUST_DEFAULT;
function setThrust(k) {
  k = Math.min(1, Math.max(0, k));
  if (Math.floor(k * 4) !== Math.floor(thrust * 4)) sound('beep');   // a click at each detent
  thrust = k;
  const pct = Math.round(k * 100);
  thrustInput.value = String(pct);
  thrustInput.style.setProperty('--fill', `${pct}%`);
  thrustNum.textContent = `${pct}%`;
  thrustInput.setAttribute('aria-valuetext', k < 0.06 ? 'Idle' : k > 0.85 ? `Full burn, ${pct}%` : `${pct}%`);
  if (scene3d) scene3d.setThrust(k);
}
thrustInput.addEventListener('input', () => setThrust(Number(thrustInput.value) / 100));

const CHANNELS = [
  { name: 'Music', ink: '--amber' },
  { name: 'Esports', ink: '--neon' },
  { name: 'Reading', ink: '--cream' },
  { name: 'Sports', ink: '--bebop-red' },
];

/* ---------- The terminal overlay (works with or without WebGL) ---------- */

let current = -1;
let opener = null;
let mode = 'lounge';   // lounge | transit | cockpit

function showTerminal(i) {
  if (i === DECK) { tape.show(); return; }
  if (i === ARCADE) {
    cabPanel.hidden = false;
    game.open();
    cabPanel.focus({ preventScroll: true });
    return;
  }
  hobbies.forEach((h, k) => { h.hidden = k !== i; });
  tvLabel.textContent = i === ABOUT ? 'Bridge / Pilot file' : `CH ${String(i + 1).padStart(2, '0')} / Receiving`;
  tv.classList.toggle('is-pilot', i === ABOUT);
  tv.hidden = false;
  tv.classList.remove('is-open');
  void tv.offsetWidth;
  tv.classList.add('is-open');
  hobbies[i].focus({ preventScroll: true });
}
function hideTerminal() {
  tape.hide();
  game.close();
  cabPanel.hidden = true;
  tv.classList.remove('is-open');
  tv.hidden = true;
}
function markChannel(i) {
  lounge.classList.toggle('is-tuned', i >= 0);
  chButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.channel) === i)));
  pilotButtons.forEach((b) => b.setAttribute('aria-pressed', String(i === ABOUT)));
  tapeButtons.forEach((b) => b.setAttribute('aria-pressed', String(i === DECK)));
}
function setMode(m) {
  mode = m;
  lounge.dataset.mode = m;   // CSS swaps the intro and the button bars
  const url = location.pathname + location.search + (m === 'cockpit' ? '#cockpit' : '');
  history.replaceState(null, '', url);
}

/* ---------- Three.js ---------- */

let scene3d = null;
try {
  scene3d = buildScene();
} catch (err) {
  // No WebGL: the channel buttons and terminals still work as a plain page
  root.classList.add('no-webgl');
}

function open(i, from) {
  if (i === current && !(i === DECK ? holo : i === ARCADE ? cabPanel : tv).hidden) return;
  // Each terminal lives on its own deck: walk there first
  if (scene3d && onBridge(i) && mode === 'lounge') { goCockpit(() => open(i, from)); return; }
  if (scene3d && !onBridge(i) && mode === 'cockpit') { goLounge(() => open(i, from)); return; }
  if (mode === 'transit') return;
  opener = from || chButton(i) || (i === DECK ? tapeButtons[0] : pilotButtons[0]);
  current = i;
  markChannel(i);
  hideTerminal();
  if (hint) hint.classList.add('is-gone');
  if (scene3d) scene3d.focus(i, () => showTerminal(i));
  else showTerminal(i);
}
function close() {
  if (current < 0) return;
  hideTerminal();
  markChannel(-1);
  current = -1;
  if (scene3d) scene3d.home();
  if (opener) opener.focus({ preventScroll: true });
}
function settle() {
  if (current < 0) return;
  hideTerminal();
  markChannel(-1);
  current = -1;
}
function goCockpit(done) {
  if (mode === 'cockpit') { if (done) done(); return; }
  if (mode !== 'lounge') return;
  settle();
  if (hint) hint.classList.add('is-gone');
  if (!scene3d) { setMode('cockpit'); if (done) done(); return; }
  setMode('transit');
  scene3d.toCockpit(() => { setMode('cockpit'); if (done) done(); });
}
function goLounge(done) {
  if (mode === 'lounge') { if (done) done(); return; }
  if (mode !== 'cockpit') return;
  settle();
  if (!scene3d) { setMode('lounge'); if (done) done(); return; }
  setMode('transit');
  scene3d.toLounge(() => { setMode('lounge'); if (done) done(); });
}

chButtons.forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.channel), b)));
pilotButtons.forEach((b) => b.addEventListener('click', () => open(ABOUT, b)));
tapeButtons.forEach((b) => b.addEventListener('click', () => open(DECK, b)));
holo.querySelector('[data-holo-close]').addEventListener('click', close);
cabPanel.querySelector('[data-cab-close]').addEventListener('click', close);
// Touch pad: held while the finger is down
cabPanel.querySelectorAll('[data-pad]').forEach((b) => {
  const set = (on) => (e) => { e.preventDefault(); b.classList.toggle('is-down', on); game.press(b.dataset.pad, on); };
  b.addEventListener('pointerdown', set(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => b.addEventListener(type, set(false)));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
deckButtons.forEach((b) => b.addEventListener('click', () => (b.dataset.deck === 'cockpit' ? goCockpit() : goLounge())));
tv.querySelector('[data-tv-close]').addEventListener('click', close);
tv.querySelector('[data-tv-prev]').addEventListener('click', () => open((current + 3) % 4));
tv.querySelector('[data-tv-next]').addEventListener('click', () => open((current + 1) % 4));
window.addEventListener('keydown', (e) => {
  if (document.body.classList.contains('is-locked')) return;   // boot screen
  // In the seat with nothing open: down pulls the throttle (faster), up eases it off
  if (mode === 'cockpit' && current < 0 && !(e.target.closest && e.target.closest('input, textarea'))) {
    const k = e.key.toLowerCase();
    if (k === 'arrowdown' || k === 's') { e.preventDefault(); setThrust(thrust + 0.1); return; }
    if (k === 'arrowup' || k === 'w') { e.preventDefault(); setThrust(thrust - 0.1); return; }
  }
  if (e.key !== 'Escape') return;
  if (current >= 0) { e.preventDefault(); close(); }
  else if (mode === 'cockpit') { e.preventDefault(); goLounge(); }
});

// A link straight to the bridge: hobbies.html#cockpit
if (location.hash === '#cockpit') {
  if (scene3d) { scene3d.jumpToCockpit(); setMode('cockpit'); }
  else open(ABOUT);
} else {
  setMode('lounge');
}
// Editing the address (or following an in-page #cockpit link) moves between decks too
window.addEventListener('hashchange', () => {
  if (location.hash === '#cockpit') goCockpit();
  else if (mode === 'cockpit') goLounge();
});

/* ==========================================================
   Scene
   ========================================================== */

function buildScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no webgl');
  const small = () => Math.min(window.innerWidth, window.innerHeight) < 600;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !small();
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = color('--space-black');
  scene.fog = new THREE.Fog(color('--space-black'), 16, 34);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1500);

  const mat = (name, rough = 0.8, metal = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, envMapIntensity: 0.35, ...extra });
  const box = (w, h, d, m, x = 0, y = 0, z = 0, parent = scene) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const rbox = (w, h, d, r, m, x = 0, y = 0, z = 0, parent = scene) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const rod = (a, b, r, m, parent = scene) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), m);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  /* ---------- Textures drawn on canvas ---------- */

  const canvasTexture = (w, h, paint, repeat) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); }
    return tex;
  };

  const world = buildWorld({ scene, renderer, token, color, box, rbox, rod, canvasTexture, small: small(), motion });
  const hyper = buildHyperspace({ scene, color, motion, small: small() });
  const cockpit = buildCockpit({ scene, token, color, box, rbox, rod, canvasTexture, small: small(), motion });
  const arcade = buildCabinet({ scene, token, color, box, canvasTexture, small: small(), motion, game });

  /* ---------- CRT monitors ---------- */

  const shellMat = mat('--crt-shell', 0.5, 0.05);
  const bezelMat = mat('--hull-dark', 0.7, 0.2);
  const backMat = mat('--crt-shell', 0.55, 0.05, { flatShading: true });   // faceted tube housing
  const screenInk = CHANNELS.map((c) => token(c.ink));
  const monitors = [];
  const pickables = [];

  // A slightly bulged screen, like real CRT glass
  const screenGeo = new THREE.PlaneGeometry(0.86, 0.66, 18, 14);
  const pos = screenGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / 0.43, y = pos.getY(i) / 0.33;
    pos.setZ(i, 0.035 * (1 - x * x) * (1 - y * y));
  }
  screenGeo.computeVertexNormals();

  const makeMonitor = (i, x, y, z, ry, tilt = -0.12) => {
    const outer = new THREE.Group();
    const body = new THREE.Group();
    body.position.y = 0.5;
    outer.add(body);

    const front = rbox(1.16, 0.96, 0.34, 0.07, shellMat, 0, 0, 0, body);
    const backWrap = new THREE.Group();
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.62, 0.62, 4, 1), backMat);
    back.rotation.y = Math.PI / 4;
    back.castShadow = true;
    backWrap.add(back);
    backWrap.rotation.x = -Math.PI / 2;
    backWrap.position.z = -0.47;
    body.add(backWrap);
    box(0.98, 0.78, 0.02, bezelMat, 0, 0.05, 0.165, body);

    // Live picture on a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.set(0, 0.05, 0.178);
    body.add(screen);

    // Knobs and power lamp under the glass
    for (let k = 0; k < 2; k++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12), bezelMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.3 + k * 0.1, -0.39, 0.18);
      body.add(knob);
    }
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: color('--neon') }));
    led.position.set(-0.4, -0.39, 0.175);
    body.add(led);

    // Cable trailing off the back
    const cable = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.1, -0.35, -0.7), new THREE.Vector3(0.35, -0.48, -1.0), new THREE.Vector3(0.7, -0.5 - y + 0.02, -1.3),
    ]);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(cable, 16, 0.02, 6), bezelMat);
    body.add(wire);

    // The screen lights the room in front of it
    const glow = new THREE.PointLight(new THREE.Color(screenInk[i]), 2.2, 4, 2);
    glow.position.set(0, 0.1, 0.7);
    body.add(glow);

    outer.position.set(x, y, z);
    outer.rotation.set(tilt, ry, 0, 'YXZ');
    scene.add(outer);

    [front, back, screen].forEach((m) => { m.userData.index = i; pickables.push(m); });
    monitors.push({ outer, body, screen, canvas, tex, glow, hover: 0, seed: Math.random() * 100 });
  };

  makeMonitor(0, 0, 0.08, 1.9, 0);              // music: on the deck plate, where someone sits cross-legged
  makeMonitor(1, -4.55, 0.58, 0.4, 0.85);        // esports: on the long couch
  makeMonitor(2, 4.6, 0.58, 1.2, -0.85);         // reading: on the short couch
  makeMonitor(3, 0.0, 0.62, -2.2, 0.15);         // sports: on the crate by the stairs

  /* ---------- Screen pictures ---------- */

  const drawScreen = (m, i, t) => {
    const g = m.canvas.getContext('2d');
    const W = m.canvas.width, H = m.canvas.height;
    const ink = screenInk[i];
    const live = motion();
    const flick = live ? 0.88 + 0.12 * Math.sin(t * 0.013 + m.seed) : 1;

    g.globalAlpha = 1;
    g.fillStyle = token('--screen-bg');
    g.fillRect(0, 0, W, H);
    g.globalAlpha = (0.75 + m.hover * 0.25) * flick;
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 3;

    const s = t / 1000;
    if (i === 0) {
      // Music: EQ bars over a waveform
      const n = 14, bw = (W - 60) / n;
      for (let k = 0; k < n; k++) {
        const v = 0.25 + 0.6 * Math.abs(Math.sin(s * (1.5 + k * 0.17) + k * 0.9 + m.seed));
        const bh = v * 110;
        for (let y = 0; y < bh; y += 9) g.fillRect(30 + k * bw, 175 - y, bw - 5, 6);
      }
      g.beginPath();
      for (let x = 20; x < W - 20; x += 4) {
        const y = 45 + Math.sin(x * 0.06 + s * 6) * 14 * Math.sin(x * 0.013 + s);
        x === 20 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    } else if (i === 1) {
      // Esports: crosshair radar with blips
      const cx = W / 2, cy = 105, r = 80;
      [r, r * 0.66, r * 0.33].forEach((rr) => { g.beginPath(); g.arc(cx, cy, rr, 0, 6.283); g.stroke(); });
      g.beginPath(); g.moveTo(cx - r - 14, cy); g.lineTo(cx + r + 14, cy); g.moveTo(cx, cy - r - 14); g.lineTo(cx, cy + r + 14); g.stroke();
      const a = s * 2.2;
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
      g.lineWidth = 3;
      [[0.6, 0.5], [2.3, 0.8], [4.1, 0.35], [5.2, 0.7]].forEach(([ang, d]) => {
        const age = ((a - ang) % 6.283 + 6.283) % 6.283;
        g.globalAlpha = Math.max(0, 1 - age / 3) * flick;
        g.fillRect(cx + Math.cos(ang) * r * d - 5, cy + Math.sin(ang) * r * d - 5, 10, 10);
      });
    } else if (i === 2) {
      // Reading: an open book whose lines scroll by
      g.strokeRect(30, 22, 125, 165); g.strokeRect(165, 22, 125, 165);
      const off = (s * 14) % 16;
      for (let p = 0; p < 2; p++) {
        for (let k = 0; k < 10; k++) {
          const y = 40 + k * 16 - off;
          if (y < 30 || y > 178) continue;
          const len = 60 + ((k * 37 + p * 53 + Math.floor(s * 14 / 16) * 11) % 45);
          g.fillRect(42 + p * 135, y, len, 4);
        }
      }
      if (live && Math.floor(s * 2) % 2) g.fillRect(270, 168, 8, 12);
    } else {
      // Sports: a pitch line and a ball arcing across; soccer then tennis
      g.strokeRect(24, 30, W - 48, 150);
      g.beginPath(); g.moveTo(W / 2, 30); g.lineTo(W / 2, 180); g.stroke();
      g.beginPath(); g.arc(W / 2, 105, 28, 0, 6.283); g.stroke();
      const phase = (s * 0.45) % 1;
      const leg = Math.floor(s * 0.45) % 2;
      const bx = 40 + phase * (W - 80);
      const by = 165 - Math.abs(Math.sin(phase * Math.PI * 2)) * 110;
      g.globalAlpha = 0.35 * flick;
      g.beginPath(); g.ellipse(bx, 172, 12, 4, 0, 0, 6.283); g.fill();
      g.globalAlpha = flick;
      g.fillStyle = leg ? token('--neon') : token('--cream');
      g.beginPath(); g.arc(bx, by, leg ? 9 : 13, 0, 6.283); g.fill();
      g.fillStyle = ink;
    }

    // Channel strip
    g.globalAlpha = flick;
    g.fillStyle = ink;
    g.font = '26px VT323, monospace';
    g.fillText(`CH ${String(i + 1).padStart(2, '0')}  ${CHANNELS[i].name.toUpperCase()}`, 16, 222);
    if (m.hover > 0.5 && i !== focused && Math.floor(t / 400) % 2) g.fillText('PRESS TO TUNE', W - 150, 222);

    // Scanlines and speckle
    g.globalAlpha = 1;
    g.fillStyle = token('--screen-scan');
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    if (live) {
      g.fillStyle = token('--cream');
      for (let k = 0; k < 40; k++) g.fillRect(Math.random() * W, Math.random() * H, 2, 1);
    }
    m.tex.needsUpdate = true;
  };

  /* ---------- Camera ---------- */

  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3(0, 1.2, -1.2) };
  const view = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let tween = null;
  let focused = -1;
  let deck = 'lounge';     // lounge | transit | cockpit (the scene's own copy of the mode)
  let yaw = 0, yawGoal = 0;
  const pointer = { x: 0, y: 0 };
  // Head turn in the pilot's seat: drag for a full 360, the pointer adds a little sway
  const head = { yaw: 0, pitch: 0, yawGoal: 0, pitchGoal: 0 };
  const actual = new THREE.Vector3();   // where the camera is really looking this frame

  const layout = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait screens pull the camera back and up so the whole lounge fits
    const portrait = w / h < 1;
    camera.fov = portrait ? 82 : 48;
    camera.updateProjectionMatrix();
    // Phones stand inside the room, up by the ceiling, so the frame never shows past
    // the walls; wide screens keep the cutaway view from just beyond the front wall
    home.pos.set(0, portrait ? 7.3 : 6.4, portrait ? 7.1 : 9.6);
    home.target.set(0, portrait ? 0.4 : 1.2, portrait ? -2.6 : -1.2);
    if (focused >= 0 && !tween) Object.assign(view, focusPose(focused));
  };

  const screenOf = (i) => (i === ARCADE ? arcade.screen : i === DECK ? cockpit.tapeAnchor : i === ABOUT ? cockpit.aboutScreen : monitors[i].screen);
  const focusPose = (i) => {
    const s = screenOf(i);
    const center = new THREE.Vector3();
    s.getWorldPosition(center);
    const q = new THREE.Quaternion();
    s.getWorldQuaternion(q);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const portrait = camera.aspect < 1;
    const near = onBridge(i);   // the console monitor is small and close; lean in rather than fly
    const pos = center.clone().addScaledVector(normal, i === ARCADE ? (portrait ? 4.2 : 3.1) : i === DECK ? 2.1 : near ? (portrait ? 1.7 : 1.25) : (portrait ? 3.0 : 2.35)).addScaledVector(up, near ? 0.05 : 0.15);
    // Leave room for the terminal: the monitor sits left on wide screens, high on tall ones
    const target = center.clone();
    // The deck projects its panel straight up: aim high so the deck sits low in the frame
    if (i === DECK) target.addScaledVector(up, portrait ? 1.05 : 0.62);
    else if (portrait) target.addScaledVector(up, i === ARCADE ? -1.2 : near ? -0.4 : -0.55);
    else target.addScaledVector(right, near ? 0.32 : 0.55);
    return { pos, target };
  };

  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const flyTo = (to, done) => {
    if (!motion()) { view.pos.copy(to.pos); view.target.copy(to.target); tween = null; if (done) done(); return; }
    // Start from where the camera is really looking, so a turned head eases round
    tween = { from: { pos: camera.position.clone(), target: actual.clone() }, to, t0: performance.now(), dur: 1100, done };
  };
  // A longer walk along curves: up the stairs and through the door
  const walk = (posPts, targetPts, dur, done) => {
    if (!motion()) {
      view.pos.copy(posPts[posPts.length - 1]); view.target.copy(targetPts[targetPts.length - 1]);
      tween = null; if (done) done(); return;
    }
    tween = { path: new THREE.CatmullRomCurve3(posPts), aim: new THREE.CatmullRomCurve3(targetPts), t0: performance.now(), dur, done };
  };

  const homePose = () => {
    const p = home.pos.clone().sub(home.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(home.target);
    return { pos: p, target: home.target.clone() };
  };
  const seatPose = () => ({ pos: cockpit.seat.pos.clone(), target: cockpit.seat.target.clone() });
  const restPose = () => (deck === 'cockpit' ? seatPose() : homePose());

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const STAIR_PATH = [V(2.3, 2.5, 1.4), V(2.3, 3.6, -2.6), V(2.3, 4.45, -5.6), V(2.1, 4.4, -8.6)];
  const STAIR_AIM = [V(2.3, 2.6, -4.0), V(2.3, 4.4, -7.5), V(2.2, 4.4, -11), V(2.0, 4.35, -16)];

  /* ---------- Pointer: hover, click, drag ---------- */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;
  let drag = null;

  const aim = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const pick = () => {
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.index : -1;
  };
  const hits = (list) => ray.intersectObjects(list, false).length > 0;

  // What the pointer is over, by deck
  const target = (e) => {
    aim(e);
    if (deck === 'cockpit') return hits(cockpit.aboutHits) ? { kind: 'about' } : hits(cockpit.tapeHits) ? { kind: 'tape' } : hits(cockpit.throttleHits) ? { kind: 'throttle' } : null;
    if (deck !== 'lounge') return null;
    const i = pick();
    if (i >= 0) return { kind: 'monitor', i };
    if (hits(arcade.hits)) return { kind: 'arcade' };
    if (hits(world.doorHits)) return { kind: 'door' };
    if (hits(world.dogHits)) return { kind: 'dog' };
    return null;
  };

  const el = renderer.domElement;
  let hotKey = '';
  let lever = null;   // dragging the throttle
  el.addEventListener('pointerdown', (e) => {
    if (deck === 'cockpit' && focused < 0) {
      aim(e);
      if (hits(cockpit.throttleHits)) {
        lever = { y: e.clientY, k: thrust };
        el.setPointerCapture(e.pointerId);
        return;
      }
    }
    drag = { x: e.clientX, y: e.clientY, yaw: yawGoal, headYaw: head.yawGoal, headPitch: head.pitchGoal, moved: false };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    // Pull down for more thrust, push up to ease off
    if (lever) { setThrust(lever.k + (e.clientY - lever.y) / 220); return; }
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) drag.moved = true;
      if (drag.moved && focused < 0 && deck === 'lounge') yawGoal = THREE.MathUtils.clamp(drag.yaw - dx * 0.004, -0.5, 0.5);
      if (drag.moved && focused < 0 && deck === 'cockpit') {
        head.yawGoal = drag.headYaw + dx * 0.0035;
        head.pitchGoal = THREE.MathUtils.clamp(drag.headPitch + dy * 0.004, -0.9, 0.9);
      }
      return;
    }
    const t = target(e);
    el.style.cursor = t ? (t.kind === 'throttle' ? 'ns-resize' : 'pointer') : (deck === 'transit' ? 'default' : 'grab');
    const key = t ? t.kind + (t.i ?? '') : '';
    if (key !== hotKey) {
      hotKey = key;
      if (t && t.kind !== 'dog') sound('buzz');
    }
    hovered = t && t.kind === 'monitor' ? t.i : -1;
    arcade.setHot(!!t && t.kind === 'arcade');
    cockpit.setHot(!!t && t.kind === 'about');
    cockpit.setTapeHot(!!t && t.kind === 'tape');
    chButtons.forEach((b) => b.classList.toggle('is-hot', Number(b.dataset.channel) === (t && t.kind === 'arcade' ? ARCADE : hovered)));
  });
  el.addEventListener('pointerup', (e) => {
    if (lever) { lever = null; return; }
    const wasDrag = drag && drag.moved;
    drag = null;
    if (wasDrag) return;
    const t = target(e);
    if (t && t.kind === 'monitor') { sound('zap'); open(t.i, chButton(t.i)); }
    else if (t && t.kind === 'arcade') { sound('zap'); open(ARCADE, chButton(ARCADE)); }
    else if (t && t.kind === 'about') { sound('zap'); open(ABOUT, pilotButtons[0]); }
    else if (t && t.kind === 'tape') { sound('zap'); open(DECK, tapeButtons[0]); }
    else if (t && t.kind === 'door') goCockpit();
    else if (t && t.kind === 'dog') { sound('buzz'); world.pokeDog(); }
    else if (focused >= 0) close();
  });
  el.addEventListener('pointerleave', () => {
    hovered = -1;
    hotKey = '';
    cockpit.setHot(false);
    cockpit.setTapeHot(false);
    chButtons.forEach((b) => b.classList.remove('is-hot'));
    arcade.setHot(false);
  });

  /* ---------- Loop ---------- */

  layout();
  Object.assign(view, homePose());
  // Compile every shader up front (off the main thread where supported), so
  // walking into the cockpit never stalls on first-time shader builds
  if (renderer.compileAsync) renderer.compileAsync(scene, camera).catch(() => {});
  else renderer.compile(scene, camera);
  let lastScreens = 0;
  let lastT = 0;
  let nextBeep = 3000;
  const lensPos = new THREE.Vector3();
  tape.onChange((on) => cockpit.setPlaying(on));

  const frame = (t) => {
    requestAnimationFrame(frame);   // schedule first, so one bad frame can never stop the loop
    try { step(t); } catch (err) { console.error(err); }
  };
  const step = (t) => {
    const dt = THREE.MathUtils.clamp((t - lastT) / 1000, 0, 0.1);
    lastT = t;
    world.update(t, dt);
    arcade.update(t);
    hyper.update(t, dt);
    cockpit.update(t, dt);

    // Camera
    if (tween && tween.path) {
      const p = THREE.MathUtils.clamp((t - tween.t0) / tween.dur, 0, 1);   // frame time can predate the click
      const k = ease(p);
      view.pos.copy(tween.path.getPoint(k));
      view.target.copy(tween.aim.getPoint(k));
      if (p >= 1) { const done = tween.done; tween = null; if (done) done(); }
    } else if (tween) {
      const p = THREE.MathUtils.clamp((t - tween.t0) / tween.dur, 0, 1);   // frame time can predate the click
      const k = ease(p);
      view.pos.lerpVectors(tween.from.pos, tween.to.pos, k);
      view.target.lerpVectors(tween.from.target, tween.to.target, k);
      if (p >= 1) { const done = tween.done; tween = null; if (done) done(); }
    } else if (focused < 0) {
      if (deck === 'lounge') yaw += (yawGoal - yaw) * 0.08;
      const rp = restPose();
      view.pos.copy(rp.pos);
      view.target.copy(rp.target);
    }
    camera.position.copy(view.pos);
    const lookTarget = view.target.clone();
    if (motion() && !tween) {
      if (deck === 'cockpit' && focused < 0) {
        camera.position.y += Math.sin(t * 0.0016) * 0.008;   // the hum of the hull
      } else if (deck === 'lounge') {
        // A slow drift and a little pointer parallax keep the room alive
        camera.position.x += Math.sin(t * 0.00023) * 0.08 + pointer.x * (focused < 0 ? 0.35 : 0.05);
        camera.position.y += Math.sin(t * 0.00031) * 0.05 - pointer.y * (focused < 0 ? 0.2 : 0.03);
      }
    }
    if (deck === 'cockpit' && focused < 0 && !tween) {
      // Seated: turn the head around the forward line, by drag plus a little pointer sway
      head.yaw += (head.yawGoal - head.yaw) * 0.12;
      head.pitch += (head.pitchGoal - head.pitch) * 0.12;
      const fwd = view.target.clone().sub(view.pos);
      const dist = fwd.length();
      fwd.normalize();
      const sway = motion() ? 1 : 0;
      const yawA = Math.atan2(fwd.x, fwd.z) + head.yaw - pointer.x * 0.12 * sway;
      const pitchA = THREE.MathUtils.clamp(Math.asin(fwd.y) - head.pitch - pointer.y * 0.08 * sway, -1.3, 1.3);
      lookTarget.copy(camera.position).add(new THREE.Vector3(Math.sin(yawA) * Math.cos(pitchA), Math.sin(pitchA), Math.cos(yawA) * Math.cos(pitchA)).multiplyScalar(dist));
    }
    // Your own seat is right behind your eyes: hide it once you turn round to face the cabin
    const turned = Math.abs(Math.atan2(Math.sin(head.yaw), Math.cos(head.yaw)));
    cockpit.ownSeat.visible = !(deck === 'cockpit' && turned > 1.2);
    actual.copy(lookTarget);
    camera.lookAt(lookTarget);

    // Monitors: hover swell, screen redraw at ~15fps
    monitors.forEach((m, i) => {
      const goal = i === hovered || i === focused ? 1 : 0;
      m.hover += (goal - m.hover) * 0.15;
      const sc = 1 + m.hover * 0.05;
      m.body.scale.setScalar(sc);
      m.glow.intensity = (2.2 + m.hover * 2.5) * (motion() ? 0.9 + 0.1 * Math.sin(t * 0.02 + m.seed) : 1);
    });
    if (t - lastScreens > (motion() ? 66 : 1000)) {
      monitors.forEach((m, i) => drawScreen(m, i, t));
      world.redraw(t);
      arcade.redraw(t);
      cockpit.redraw(t);
      lastScreens = t;
    }

    // The console chirps now and then while you're at the controls
    if (deck === 'cockpit' && motion()) {
      nextBeep -= dt * 1000;
      if (nextBeep <= 0) { sound('beep'); nextBeep = 2500 + Math.random() * 4500; }
    }

    // The holo beam follows the deck's lens on screen
    if (!holo.hidden) {
      const r = el.getBoundingClientRect();
      const toScreen = (o) => { o.getWorldPosition(lensPos); lensPos.project(camera); return [r.left + (lensPos.x + 1) / 2 * r.width, r.top + (1 - lensPos.y) / 2 * r.height]; };
      const [tx, ty] = toScreen(cockpit.tapeTop);
      const [lx, ly] = toScreen(cockpit.tapeLens);
      tape.beam(lx, ly, tx, Math.min(ty, ly));
    }

    renderer.render(scene, camera);
  };
  requestAnimationFrame(frame);

  let timer;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(layout, 120); });
  el.style.cursor = 'grab';

  return {
    setThrust(k) { hyper.setThrust(k); cockpit.setThrust(k); },
    focus(i, done) {
      focused = i;
      head.yaw = head.pitch = head.yawGoal = head.pitchGoal = 0;   // the fly-in starts from the turned view
      flyTo(focusPose(i), done);
    },
    home() {
      focused = -1;
      flyTo(restPose());
    },
    toCockpit(done) {
      focused = -1;
      deck = 'transit';
      world.setDoor(true);
      sound('slide');
      const seat = seatPose();
      // Give the door a moment to start opening before the climb
      head.yaw = head.pitch = head.yawGoal = head.pitchGoal = 0;
      walk([camera.position.clone(), ...STAIR_PATH, seat.pos], [actual.clone(), ...STAIR_AIM, seat.target], 3600, () => {
        deck = 'cockpit';
        if (done) done();
      });
    },
    toLounge(done) {
      focused = -1;
      deck = 'transit';
      yaw = yawGoal = 0;
      const rest = homePose();
      walk([camera.position.clone(), ...STAIR_PATH.slice().reverse(), rest.pos], [actual.clone(), V(2.3, 4.4, -6), V(2.3, 3.0, -2), V(1.5, 1.6, 0.5), V(0.5, 1.3, -0.5), rest.target], 3400, () => {
        deck = 'lounge';
        world.setDoor(false);
        sound('slide');
        if (done) done();
      });
    },
    jumpToCockpit() {
      deck = 'cockpit';
      head.yaw = head.pitch = head.yawGoal = head.pitchGoal = 0;
      world.setDoor(true);
      Object.assign(view, seatPose());
    },
  };
}
