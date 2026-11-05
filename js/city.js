import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildShip } from './ship.js';

/* ==========================================================
   Tijuana, on Mars: where the ship sets down if you plot a
   course for the red planet. A downtown crossroads at dusk:
   towers with lit windows and neon, an elevated highway on
   steel trusses, traffic lights, street signs, parked and
   passing cars, rust dust in the air. The ship stands on a
   plaza beside the crossing; a street terminal carries the
   bounty board (projects). Same interface as the campsite.
   ========================================================== */

export function buildCity({ token, color, small, motion, canvasTexture }) {
  const scene = new THREE.Scene();
  scene.background = color('--mars-sky');
  scene.fog = new THREE.FogExp2(color('--mars-haze'), 0.016);

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const updaters = [];
  const live = (fn) => updaters.push(fn);
  const mat = (name, rough = 0.8, metal = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, ...extra });
  const glow = (name) => new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });
  const add = (m, parent = scene) => { m.castShadow = m.receiveShadow = false; parent.add(m); return m; };
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = scene) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return add(o, parent); };
  const box = (w, h, d, m, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const rod = (a, b, r, m, parent = scene) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 6), m);
    o.position.copy(a).addScaledVector(dir, 0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return add(o, parent);
  };
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- Streets ---------- */

  const ROAD = 8;   // road width; the two roads cross at the origin
  const ground = mesh(new THREE.PlaneGeometry(240, 240), mat('--stone', 0.95, 0));
  ground.rotation.x = -Math.PI / 2;
  const asphalt = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = token('--soot'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--rule');
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    g.fillStyle = token('--amber'); g.fillRect(w / 2 - 2, 0, 4, h * 0.5);   // dashed centre line
  }, [1, 12]);
  [0, Math.PI / 2].forEach((ry) => {
    const r = mesh(new THREE.PlaneGeometry(ROAD, 200), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9 }), 0, 0.01, 0);
    r.rotation.set(-Math.PI / 2, 0, ry);
  });
  // Crosswalks on all four sides of the crossing
  const stripe = mat('--cream', 0.9, 0);
  [[0, ROAD / 2 + 1], [0, -ROAD / 2 - 1], [ROAD / 2 + 1, 0], [-ROAD / 2 - 1, 0]].forEach(([cx, cz]) => {
    for (let k = -3; k <= 3; k++) {
      const along = cx === 0;
      box(along ? 0.5 : 1.6, 0.02, along ? 1.6 : 0.5, stripe, cx + (along ? k * 1.05 : 0), 0.02, cz + (along ? 0 : k * 1.05));
    }
  });
  // Raised kerbs round each block
  const curb = mat('--hull-mid', 0.8, 0.1);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    box(60, 0.18, 0.3, curb, sx * (ROAD / 2 + 30), 0.09, sz * (ROAD / 2 + 0.15));
    box(0.3, 0.18, 60, curb, sx * (ROAD / 2 + 0.15), 0.09, sz * (ROAD / 2 + 30));
  });

  /* ---------- Towers ---------- */

  // A few facades: dark bands of windows, some lit amber or cream
  const facades = [0, 1, 2].map((v) => canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = token(v === 1 ? '--hull-dark' : '--soot'); g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 16) for (let x = 6; x < w; x += 14) {
      const lit = Math.random();
      g.fillStyle = token(lit > 0.72 ? '--amber' : lit > 0.62 ? '--cream' : lit > 0.55 ? '--lamp-warm' : '--space-black');
      g.globalAlpha = lit > 0.55 ? 0.9 : 1;
      g.fillRect(x, y, 9, 9);
    }
    g.globalAlpha = 1;
  }, [2, 3]));
  const facadeM = facades.map((map) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0.1, emissive: color('--lamp-warm'), emissiveMap: map, emissiveIntensity: 0.45 }));
  const SIGNS = ['TIJUANA', 'HOTEL', 'CANTINA', 'NOODLES', 'BAR', 'PAWN', 'EAST', 'CAFE', 'MOTEL', 'TACOS'];
  const INKS = ['--bebop-red', '--amber', '--neon-cyan', '--cream', '--neon'];
  const neon = [];
  const sign = (text, ink, w, h, vertical) => {
    const tex = canvasTexture(vertical ? 64 : 256, vertical ? 256 : 64, (g, cw, ch) => {
      g.fillStyle = token('--space-black'); g.fillRect(0, 0, cw, ch);
      g.strokeStyle = token(ink); g.lineWidth = 4; g.strokeRect(4, 4, cw - 8, ch - 8);
      g.fillStyle = token(ink); g.textAlign = 'center';
      if (vertical) {
        g.font = 'bold 30px Syncopate, sans-serif';
        [...text].forEach((ch2, i) => g.fillText(ch2, cw / 2, 40 + i * (200 / Math.max(5, text.length))));
      } else {
        g.font = 'bold 34px Syncopate, sans-serif'; g.fillText(text, cw / 2, 44);
      }
    });
    const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    neon.push({ m, seed: rand() * 10 });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  };
  // Blocks: four quadrants, leaving the plaza (+x, -z) open for the ship
  const towers = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], q) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const near = i === 0 || j === 0;
      if (q === 3 && i < 3 && j < 2) continue;   // the plaza
      const w = 5 + rand() * 3, d = 5 + rand() * 3, hgt = (near ? 6 : 10) + rand() * (near ? 10 : 22);
      const x = sx * (ROAD / 2 + 4 + i * 8.5), z = sz * (ROAD / 2 + 4 + j * 8.5);
      const t = box(w, hgt, d, facadeM[(i + j + q) % 3], x, hgt / 2, z);
      towers.push(t);
      box(w * 0.3, 1.2, d * 0.3, mat('--hull-mid', 0.7, 0.3), x + w * 0.2, hgt + 0.6, z);   // rooftop plant
      if (near && rand() < 0.75) {
        const vertical = rand() < 0.5;
        const sg = sign(SIGNS[Math.floor(rand() * SIGNS.length)], INKS[Math.floor(rand() * INKS.length)], vertical ? 1.2 : 4.2, vertical ? 4.6 : 1.1, vertical);
        // Face the crossing: on the side toward the nearer road
        const towardX = Math.abs(x) < Math.abs(z) ? false : true;
        if (towardX) { sg.position.set(x - sx * (w / 2 + 0.06), 3.5 + rand() * 3, z); sg.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; }
        else { sg.position.set(x, 3.5 + rand() * 3, z - sz * (d / 2 + 0.06)); sg.rotation.y = sz > 0 ? Math.PI : 0; }
        scene.add(sg);
      }
    }
  });
  // The big rooftop sign over the far corner
  const big = sign('TIJUANA', '--bebop-red', 10, 2.4, false);
  big.position.set(-14, 22, -16);
  big.rotation.y = 0.6;
  scene.add(big);
  live((t) => {
    if (!motion()) return;
    neon.forEach((n) => { n.m.color.setScalar(Math.sin(t * 0.003 + n.seed) > -0.92 || Math.random() > 0.3 ? 1 : 0.35); });
  });

  /* ---------- Elevated highway on steel trusses ---------- */

  const highway = new THREE.Group();
  highway.position.set(0, 9, -2);
  highway.rotation.y = 0.45;
  scene.add(highway);
  const steel = mat('--hull-dark', 0.6, 0.6);
  box(140, 0.6, 5, mat('--hull-mid', 0.8, 0.2), 0, 0, 0, highway);
  [-1, 1].forEach((s) => {
    box(140, 0.5, 0.15, mat('--bebop-red', 0.7, 0.1), 0, 0.55, s * 2.45, highway);   // barrier
    for (let x = -70; x < 70; x += 3) {
      rod(V(x, -0.3, s * 2.5), V(x + 1.5, -2.2, s * 2.5), 0.08, steel, highway);
      rod(V(x + 1.5, -2.2, s * 2.5), V(x + 3, -0.3, s * 2.5), 0.08, steel, highway);
    }
    box(140, 0.14, 0.14, steel, 0, -2.2, s * 2.5, highway);
  });
  [-40, -24, 36, 52].forEach((x) => box(1.2, 9, 1.2, steel, x, -4.5, 0, highway));   // columns clear of the crossing and the plaza
  // Traffic up on the highway
  const carColors = ['--bebop-red', '--cream', '--teal', '--amber', '--hull-mid'];
  const makeCar = (ink) => {
    const c = new THREE.Group();
    box(2.2, 0.55, 1.1, mat(ink, 0.5, 0.3), 0, 0.45, 0, c);
    box(1.2, 0.45, 1.0, mat('--hull-dark', 0.3, 0.4), -0.15, 0.95, 0, c);
    [[-0.7, 0.55], [0.7, 0.55], [-0.7, -0.55], [0.7, -0.55]].forEach(([x, z]) => {
      const w = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10), mat('--space-black', 0.9, 0), x, 0.22, z, c);
      w.rotation.x = Math.PI / 2;
    });
    box(0.04, 0.12, 0.8, glow('--lamp-warm'), 1.11, 0.5, 0, c);    // headlights
    box(0.04, 0.12, 0.8, glow('--bebop-red'), -1.11, 0.5, 0, c);   // tail lights
    return c;
  };
  const flow = [];
  for (let k = 0; k < 6; k++) {
    const c = makeCar(carColors[k % carColors.length]);
    const dir = k % 2 ? 1 : -1;
    c.position.set(-60 + k * 22, 0.3, dir * 1.2);
    c.rotation.y = dir > 0 ? 0 : Math.PI;
    highway.add(c);
    flow.push({ c, dir, speed: 9 + rand() * 5, lane: 'high' });
  }
  // And at street level, along the x road
  for (let k = 0; k < 4; k++) {
    const c = makeCar(carColors[(k + 2) % carColors.length]);
    const dir = k % 2 ? 1 : -1;
    c.position.set(-50 + k * 30, 0, dir * -1.8);
    c.rotation.y = dir > 0 ? 0 : Math.PI;
    scene.add(c);
    flow.push({ c, dir, speed: 6 + rand() * 4, lane: 'street' });
  }
  live((t, dt) => {
    if (!motion()) return;
    flow.forEach((f) => {
      f.c.position.x += f.dir * f.speed * dt;
      const lim = f.lane === 'high' ? 70 : 60;
      if (f.c.position.x > lim) f.c.position.x = -lim;
      if (f.c.position.x < -lim) f.c.position.x = lim;
    });
  });
  // Parked cars along the kerbs
  [[-12, 3.2, 0], [-18, 3.2, 0], [3.2, 13, Math.PI / 2], [-3.2, 19, -Math.PI / 2], [-3.2, -14, Math.PI / 2]].forEach(([x, z, ry], k) => {
    const c = makeCar(carColors[(k + 1) % carColors.length]);
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    scene.add(c);
  });

  /* ---------- Street furniture ---------- */

  // Traffic lights on each corner, cycling
  const signals = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], k) => {
    const x = sx * (ROAD / 2 + 0.8), z = sz * (ROAD / 2 + 0.8);
    rod(V(x, 0, z), V(x, 4.2, z), 0.08, steel);
    box(0.4, 1.1, 0.35, mat('--space-black', 0.6, 0.3), x, 3.8, z);
    const lamps = ['--bebop-red', '--amber', '--neon'].map((ink, i) => {
      const m = new THREE.MeshBasicMaterial({ color: color(ink), toneMapped: false });
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), m);
      l.position.set(x, 4.15 - i * 0.33, z - sz * 0.18);
      l.rotation.y = sz > 0 ? Math.PI : 0;
      scene.add(l);
      return { m, base: color(ink) };
    });
    signals.push({ lamps, phase: k % 2 ? 0 : 2 });
  });
  live((t) => {
    const step = Math.floor(t / 2500) % 4;
    signals.forEach(({ lamps, phase }) => {
      const s = (step + phase) % 4;
      const on = s < 2 ? 2 : s === 2 ? 1 : 0;   // green, green, amber, red
      lamps.forEach((l, i) => l.m.color.copy(l.base).multiplyScalar(i === on ? 1 : 0.12));
    });
  });
  // Direction signs: blue panels with white arrows, and a round speed sign
  const signTex = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = token('--earth-ocean'); g.fillRect(0, 0, w, h);
    g.strokeStyle = token('--cream'); g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = token('--cream'); g.font = 'bold 26px "Share Tech Mono", monospace';
    g.fillText('< EAST', 20, 50); g.fillText('PORT 5 ^', 20, 96);
  });
  [[ROAD / 2 + 1.6, -ROAD / 2 - 3], [-ROAD / 2 - 1.6, ROAD / 2 + 3]].forEach(([x, z], k) => {
    rod(V(x, 0, z), V(x, 3.4, z), 0.07, steel);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }));
    p.position.set(x, 3.2, z + (k ? -0.05 : 0.05));
    p.rotation.y = k ? Math.PI : 0;
    p.material.side = THREE.DoubleSide;
    scene.add(p);
  });
  const speedTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = token('--cream'); g.beginPath(); g.arc(w / 2, h / 2, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = token('--bebop-red'); g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, 52, 0, Math.PI * 2); g.stroke();
    g.fillStyle = token('--space-black'); g.font = 'bold 44px "Share Tech Mono", monospace'; g.textAlign = 'center'; g.fillText('50', w / 2, h / 2 + 15);
  });
  rod(V(ROAD / 2 + 1.4, 0, ROAD / 2 + 4), V(ROAD / 2 + 1.4, 2.6, ROAD / 2 + 4), 0.06, steel);
  const speed = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshStandardMaterial({ map: speedTex, roughness: 0.6, side: THREE.DoubleSide }));
  speed.position.set(ROAD / 2 + 1.4, 2.7, ROAD / 2 + 4.05);
  scene.add(speed);
  // Street lamps
  [[ROAD / 2 + 1, 10], [-ROAD / 2 - 1, -10], [12, ROAD / 2 + 1], [-12, -ROAD / 2 - 1], [ROAD / 2 + 1, -8]].forEach(([x, z], k) => {
    rod(V(x, 0, z), V(x, 5.2, z), 0.08, steel);
    box(0.8, 0.15, 0.35, steel, x, 5.25, z);
    box(0.6, 0.05, 0.25, glow('--lamp-warm'), x, 5.15, z).castShadow = false;
    if (!small && k < 4) {
      const l = new THREE.PointLight(color('--lamp-warm'), 14, 14, 1.6);
      l.position.set(x, 4.9, z);
      scene.add(l);
    }
  });

  /* ---------- The plaza and the ship ---------- */

  const pad = mesh(new THREE.CircleGeometry(7, 40), mat('--hull-mid', 0.9, 0.1), 15, 0.02, -15);
  pad.rotation.x = -Math.PI / 2;
  const ring = mesh(new THREE.RingGeometry(6.4, 6.7, 40), glow('--amber'), 15, 0.03, -15);
  ring.rotation.x = -Math.PI / 2;
  const { ship, thrusters, hits: shipHits } = buildShip({ color, token, canvasTexture, small });
  ship.position.set(15, 0, -15);
  ship.rotation.y = -1.95;   // nose toward the street, her length along the plaza
  scene.add(ship);
  const landed = 0;
  // Floodlights on the plaza so she reads against the dusk
  [[8.5, -9], [21, -21]].forEach(([x, z]) => {
    rod(V(x, 0, z), V(x, 7, z), 0.1, steel);
    box(0.9, 0.3, 0.5, steel, x, 7.1, z);
    box(0.7, 0.05, 0.35, glow('--lamp-warm'), x, 6.95, z).castShadow = false;
  });
  const flood = new THREE.PointLight(color('--lamp-warm'), small ? 18 : 34, 26, 1.4);
  flood.position.set(15, 8, -10);
  scene.add(flood);

  /* ---------- The street terminal: the bounty board ---------- */

  const kiosk = new THREE.Group();
  box(1.4, 2.6, 0.9, mat('--hull-mid', 0.6, 0.4), 0, 1.3, 0, kiosk);
  box(1.5, 0.3, 1.0, mat('--bebop-red', 0.6, 0.2), 0, 2.75, 0, kiosk);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.86, 0.2, 3, 0.05), mat('--crt-shell', 0.5, 0.05));
  shell.position.set(0, 1.75, 0.5);
  kiosk.add(shell);
  const kCanvas = document.createElement('canvas');
  kCanvas.width = 320; kCanvas.height = 240;
  const kTex = new THREE.CanvasTexture(kCanvas);
  kTex.colorSpace = THREE.SRGBColorSpace;
  const crtScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.64), new THREE.MeshBasicMaterial({ map: kTex, toneMapped: false }));
  crtScreen.position.set(0, 1.77, 0.61);
  kiosk.add(crtScreen);
  kiosk.position.set(ROAD / 2 + 3.2, 0, -ROAD / 2 - 2.4);   // on the plaza corner, facing the street
  kiosk.rotation.y = 1.15;
  scene.add(kiosk);
  let crtHot = false;
  const drawKiosk = (t) => {
    const g = kCanvas.getContext('2d');
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, 320, 240);
    g.fillStyle = token('--amber'); g.font = '28px VT323, monospace'; g.fillText('BOUNTY BOARD', 20, 40);
    g.fillStyle = token('--ink-dim'); g.font = '18px VT323, monospace'; g.fillText('TIJUANA / MARS', 20, 64);
    ['DISCOVER ME', 'CAPACITY PIPELINE', 'APPRAISAL READER'].forEach((n, i) => {
      g.fillStyle = token(i % 2 ? '--cream' : '--neon'); g.font = '20px VT323, monospace';
      g.fillText(`${String(i + 1).padStart(2, '0')}  ${n}`, 20, 104 + i * 28);
    });
    if (crtHot || Math.floor(t / 500) % 2) { g.fillStyle = token('--bebop-red'); g.font = '22px VT323, monospace'; g.fillText('> OPEN THE FILES', 20, 214); }
    g.fillStyle = token('--screen-scan');
    for (let y = 0; y < 240; y += 3) g.fillRect(0, y, 320, 1);
    kTex.needsUpdate = true;
  };

  /* ---------- Sky, sun, dust ---------- */

  scene.add(new THREE.HemisphereLight(color('--mars-dust'), color('--mars-dark'), 0.8));
  const sun = new THREE.DirectionalLight(color('--lamp-warm'), 1.1);
  sun.position.set(-60, 20, -80);
  scene.add(sun);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(5, 24), new THREE.MeshBasicMaterial({ color: color('--cream'), fog: false }));
  sunDisc.position.set(-120, 30, -170);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  const DUST = small ? 120 : 260;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dustPos[i * 3] = (rand() - 0.5) * 70; dustPos[i * 3 + 1] = rand() * 14; dustPos[i * 3 + 2] = (rand() - 0.5) * 70; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: color('--mars-dust'), size: 2, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false })));
  live((t, dt) => {
    if (!motion()) return;
    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3] += dt * 2.5;
      dustPos[i * 3 + 1] += Math.sin(t * 0.001 + i) * dt * 0.2;
      if (dustPos[i * 3] > 35) dustPos[i * 3] = -35;
    }
    dustGeo.attributes.position.needsUpdate = true;
  });

  // Coming down and going up: 0 is landed on the plaza, 1 high above the towers
  let flight = null;
  let height = 0;
  const setHeight = (h) => { height = h; ship.position.y = landed + h * 34; ship.rotation.z = Math.sin(h * 6) * 0.04; };
  live((t) => {
    if (flight) {
      const p = Math.min(1, (t - flight.t0) / flight.dur);
      const k = flight.to > flight.from ? p * p : 1 - Math.pow(1 - p, 3);
      setHeight(flight.from + (flight.to - flight.from) * k);
      if (p >= 1) flight = null;
    }
    thrusters.forEach((c, i) => {
      c.visible = !!flight;
      c.scale.y = 0.8 + (motion() ? Math.sin(t * 0.05 + i) * 0.2 : 0);
    });
  });

  return {
    scene,
    crtScreen,
    hits: { crt: [shell, crtScreen], fire: [], ship: shipHits },
    // Where the camera rests: out on the street, looking back across the plaza to the crossing
    pose(portrait) {
      return portrait
        ? { pos: V(25, 11, 2.5), target: V(12, 3, -12) }
        : { pos: V(27, 6.5, 2.5), target: V(11, 3.2, -11) };
    },
    update(t, dt) { updaters.forEach((fn) => fn(t, dt)); },
    redraw(t) { drawKiosk(t); },
    setCrtHot(v) { crtHot = v; },
    stoke() {},
    land(dur = 4200) { setHeight(1); flight = { from: 1, to: 0, t0: performance.now(), dur }; },
    liftOff(dur = 2600) { flight = { from: height, to: 1, t0: performance.now(), dur }; },
    resetLanded() { flight = null; setHeight(0); },
  };
}
