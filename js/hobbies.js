import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildWorld } from './lounge-world.js';

/* ==========================================================
   Off Duty: a ship's lounge with four CRT monitors.
   Click a monitor (or a channel button) and the camera flies in,
   then a terminal opens over the screen with that hobby.
   ========================================================== */

const root = document.documentElement;
const css = getComputedStyle(root);
const token = (name) => css.getPropertyValue(name).trim();
const color = (name) => new THREE.Color(token(name));
const motion = () => root.classList.contains('fx-on');
const sound = (name) => { if (window.agSound && window.agSound[name]) window.agSound[name](); };

const stage = document.querySelector('[data-stage]');
const tv = document.querySelector('[data-tv]');
const tvLabel = tv.querySelector('[data-tv-label]');
const hobbies = [...tv.querySelectorAll('[data-hobby]')];
const chButtons = [...document.querySelectorAll('[data-channel]')];
const hint = document.querySelector('[data-hint]');

const CHANNELS = [
  { name: 'Music', ink: '--amber' },
  { name: 'Esports', ink: '--neon' },
  { name: 'Reading', ink: '--cream' },
  { name: 'Sports', ink: '--bebop-red' },
];

/* ---------- The terminal overlay (works with or without WebGL) ---------- */

let current = -1;
let opener = null;

function showTerminal(i) {
  hobbies.forEach((h, k) => { h.hidden = k !== i; });
  tvLabel.textContent = `CH ${String(i + 1).padStart(2, '0')} / Receiving`;
  tv.hidden = false;
  tv.classList.remove('is-open');
  void tv.offsetWidth;
  tv.classList.add('is-open');
  hobbies[i].focus({ preventScroll: true });
}
function hideTerminal() {
  tv.classList.remove('is-open');
  tv.hidden = true;
}
function markChannel(i) {
  document.querySelector('.lounge').classList.toggle('is-tuned', i >= 0);
  chButtons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
}

/* ---------- Three.js ---------- */

let scene3d = null;
try {
  scene3d = buildScene();
} catch (err) {
  // No WebGL: the channel buttons and terminal still work as a plain page
  root.classList.add('no-webgl');
}

function open(i, from) {
  if (i === current && !tv.hidden) return;
  opener = from || chButtons[i];
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

chButtons.forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.channel), b)));
tv.querySelector('[data-tv-close]').addEventListener('click', close);
tv.querySelector('[data-tv-prev]').addEventListener('click', () => open((current + 3) % 4));
tv.querySelector('[data-tv-next]').addEventListener('click', () => open((current + 1) % 4));
window.addEventListener('keydown', (e) => {
  if (document.body.classList.contains('is-locked')) return;   // boot screen
  if (e.key === 'Escape' && current >= 0) { e.preventDefault(); close(); }
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

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);

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
  let yaw = 0, yawGoal = 0;
  const pointer = { x: 0, y: 0 };

  const layout = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait screens pull the camera back and up so the whole lounge fits
    const portrait = w / h < 1;
    camera.fov = portrait ? 72 : 48;
    camera.updateProjectionMatrix();
    home.pos.set(0, portrait ? 12.5 : 6.4, portrait ? 15.5 : 9.6);
    if (focused >= 0 && !tween) Object.assign(view, focusPose(focused));
  };

  const focusPose = (i) => {
    const m = monitors[i];
    const center = new THREE.Vector3();
    m.screen.getWorldPosition(center);
    const q = new THREE.Quaternion();
    m.screen.getWorldQuaternion(q);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const portrait = camera.aspect < 1;
    const pos = center.clone().addScaledVector(normal, portrait ? 3.0 : 2.35).addScaledVector(up, 0.15);
    // Leave room for the terminal: the monitor sits left on wide screens, high on tall ones
    const target = center.clone();
    if (portrait) target.addScaledVector(up, -0.55);
    else target.addScaledVector(right, 0.55);
    return { pos, target };
  };

  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const flyTo = (to, done) => {
    if (!motion()) { view.pos.copy(to.pos); view.target.copy(to.target); if (done) done(); tween = null; return; }
    tween = { from: { pos: view.pos.clone(), target: view.target.clone() }, to, t0: performance.now(), dur: 1100, done };
  };

  const homePose = () => {
    const p = home.pos.clone().sub(home.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(home.target);
    return { pos: p, target: home.target.clone() };
  };

  /* ---------- Pointer: hover, click, drag ---------- */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;
  let drag = null;

  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.index : -1;
  };
  const onDog = () => ray.intersectObjects(world.dogHits, false).length > 0;   // uses the ray pick() just cast

  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: yawGoal, moved: false };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (drag) {
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 5) drag.moved = true;
      if (drag.moved && focused < 0) yawGoal = THREE.MathUtils.clamp(drag.yaw - dx * 0.004, -0.5, 0.5);
      return;
    }
    const i = pick(e);
    const dog = i < 0 && onDog();
    el.style.cursor = i >= 0 || dog ? 'pointer' : 'grab';
    if (i !== hovered) {
      hovered = i;
      if (i >= 0) sound('buzz');
      chButtons.forEach((b, k) => b.classList.toggle('is-hot', k === i));
    }
  });
  el.addEventListener('pointerup', (e) => {
    const wasDrag = drag && drag.moved;
    drag = null;
    if (wasDrag) return;
    const i = pick(e);
    if (i >= 0) { sound('zap'); open(i, chButtons[i]); }
    else if (onDog()) { sound('buzz'); world.pokeDog(); }      // a pat for the corgi
    else if (focused >= 0) close();
  });
  el.addEventListener('pointerleave', () => {
    hovered = -1;
    chButtons.forEach((b) => b.classList.remove('is-hot'));
  });

  /* ---------- Loop ---------- */

  layout();
  Object.assign(view, homePose());
  let lastScreens = 0;
  let lastT = 0;

  const frame = (t) => {
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    world.update(t, dt);
    // Camera
    if (tween) {
      const p = Math.min(1, (t - tween.t0) / tween.dur);
      const k = ease(p);
      view.pos.lerpVectors(tween.from.pos, tween.to.pos, k);
      view.target.lerpVectors(tween.from.target, tween.to.target, k);
      if (p >= 1) { const done = tween.done; tween = null; if (done) done(); }
    } else if (focused < 0) {
      yaw += (yawGoal - yaw) * 0.08;
      const hp = homePose();
      view.pos.copy(hp.pos);
      view.target.copy(hp.target);
    }
    camera.position.copy(view.pos);
    if (motion() && !tween) {
      // A slow drift and a little pointer parallax keep the room alive
      camera.position.x += Math.sin(t * 0.00023) * 0.08 + pointer.x * (focused < 0 ? 0.35 : 0.05);
      camera.position.y += Math.sin(t * 0.00031) * 0.05 - pointer.y * (focused < 0 ? 0.2 : 0.03);
    }
    camera.lookAt(view.target);

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
      lastScreens = t;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  let timer;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(layout, 120); });
  el.style.cursor = 'grab';

  return {
    focus(i, done) {
      focused = i;
      flyTo(focusPose(i), done);
    },
    home() {
      focused = -1;
      flyTo(homePose());
    },
  };
}
