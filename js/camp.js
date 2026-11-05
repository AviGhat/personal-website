import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildShip } from './ship.js';

/* ==========================================================
   Earthside: where the ship sets down after the descent.
   A pine clearing at dusk with the ship docked on its legs,
   a campfire with embers, logs to sit on, a tent, fireflies,
   and a CRT on a crate that carries the signal home (contact).
   Its own scene, rendered instead of the ship while landed.
   ========================================================== */

export function buildCamp({ token, color, small, motion, canvasTexture }) {
  const scene = new THREE.Scene();
  scene.background = color('--sky-dusk');
  scene.fog = new THREE.FogExp2(color('--sky-dusk'), 0.022);

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const updaters = [];
  const live = (fn) => updaters.push(fn);
  const mat = (name, rough = 0.85, metal = 0.05, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, ...extra });
  const glow = (name) => new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });
  const additive = (name, opacity = 0.85) => new THREE.MeshBasicMaterial({ color: color(name), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const add = (m, parent = scene) => { m.castShadow = m.receiveShadow = !small; parent.add(m); return m; };
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = scene) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return add(o, parent); };
  const box = (w, h, d, m, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const rod = (a, b, r, m, parent = scene) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), m);
    o.position.copy(a).addScaledVector(dir, 0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return add(o, parent);
  };
  // A fixed layout every visit: a small seeded random
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- Ground, sky, light ---------- */

  const grassTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = token('--grass'); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = token(i % 3 ? '--grass-light' : '--pine');
      g.globalAlpha = 0.35 + Math.random() * 0.4;
      const x = Math.random() * w, y = Math.random() * h;
      g.fillRect(x, y, 1.5, 4 + Math.random() * 5);
    }
    g.globalAlpha = 1;
  }, [36, 36]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const dirtTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = token('--dirt'); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = token(i % 4 ? '--coffee' : '--earth-sand');
      g.globalAlpha = 0.3 + Math.random() * 0.3;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.globalAlpha = 1;
  });
  const clearing = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 }));
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.y = 0.01;
  clearing.receiveShadow = true;
  scene.add(clearing);

  scene.add(new THREE.HemisphereLight(color('--atmo'), color('--grass'), 0.65));
  const moonLight = new THREE.DirectionalLight(color('--atmo'), 0.6);
  moonLight.position.set(-30, 40, -20);
  scene.add(moonLight);

  // Stars and a moon over the treeline
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(small ? 600 : 1200);
  for (let i = 0; i < starPos.length; i += 3) {
    const a = rand() * Math.PI * 2, e = 0.12 + rand() * 1.3;
    starPos[i] = Math.cos(a) * Math.cos(e) * 260; starPos[i + 1] = Math.sin(e) * 260; starPos[i + 2] = Math.sin(a) * Math.cos(e) * 260;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: color('--cream'), size: 1.4, sizeAttenuation: false, fog: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: color('--cream'), fog: false }));
  moon.position.set(-70, 80, -170);
  scene.add(moon);

  // Far ridges, swallowed by the haze
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + rand() * 0.3, d = 90 + rand() * 30;
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(18 + rand() * 18, 24 + rand() * 26, 5), mat('--pine', 1, 0));
    ridge.position.set(Math.cos(a) * d, 8, Math.sin(a) * d);
    scene.add(ridge);
  }

  /* ---------- Pines ---------- */

  const spots = [];
  // Keep trees off the clearing, the ship, the tent, and out from in front of both camera spots
  const clear = (x, z) => Math.hypot(x, z) > 11 && Math.hypot(x - 6.2, z + 10.5) > 10 && Math.hypot(x + 6, z + 4) > 4 &&
    Math.hypot(x - 10, z - 12) > 9 && Math.hypot(x - 3.5, z - 15) > 8;
  while (spots.length < (small ? 55 : 110)) {
    const a = rand() * Math.PI * 2, d = 10 + Math.pow(rand(), 0.7) * 45;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (clear(x, z)) spots.push([x, z, 0.8 + rand() * 1.1]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), mat('--bark', 1, 0), spots.length);
  const tiers = [[1.6, 2.4, 1.9], [1.2, 2.0, 3.0], [0.75, 1.6, 4.0]].map(([r, h, y]) => ({ y, h, m: new THREE.InstancedMesh(new THREE.ConeGeometry(r, h, 7), mat('--pine', 0.95, 0), spots.length) }));
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  spots.forEach(([x, z, s], i) => {
    dummy.position.set(x, 0.8 * s, z); dummy.rotation.set(0, rand() * 6, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    tint.copy(color(i % 3 ? '--pine' : '--pine-light')).multiplyScalar(0.8 + rand() * 0.35);
    tiers.forEach(({ y, m }) => {
      dummy.position.set(x, y * s, z); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, tint);
    });
  });
  [trunks, ...tiers.map((t) => t.m)].forEach((m) => { m.castShadow = !small; m.receiveShadow = true; scene.add(m); });
  // A few bushes and rocks around the edge of the clearing
  for (let k = 0; k < 14; k++) {
    const a = rand() * Math.PI * 2, d = 7.5 + rand() * 3;
    const b = mesh(new THREE.IcosahedronGeometry(0.5 + rand() * 0.5, 0), mat(k % 3 ? '--pine-light' : '--stone', 1, 0), Math.cos(a) * d, 0.3, Math.sin(a) * d);
    b.scale.y = 0.7;
  }

  /* ---------- The campfire ---------- */

  const fire = new THREE.Group();
  scene.add(fire);
  const stoneM = mat('--stone', 0.95, 0);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    mesh(new THREE.DodecahedronGeometry(0.2 + (k % 3) * 0.04, 0), stoneM, Math.cos(a) * 0.85, 0.14, Math.sin(a) * 0.85, fire).rotation.set(k, k * 2, 0);
  }
  const barkM = mat('--bark', 1, 0);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    rod(V(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55), V(Math.cos(a) * 0.08, 0.75, Math.sin(a) * 0.08), 0.07, barkM, fire);
  }
  mesh(new THREE.CircleGeometry(0.5, 16), glow('--bebop-red'), 0, 0.03, 0, fire).rotation.x = -Math.PI / 2;   // coals
  const flames = [['--bebop-red', 0.5, 1.3], ['--amber', 0.36, 1.05], ['--cream', 0.18, 0.6]].map(([c, r, h], i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 1, true), additive(c, 0.7));
    f.position.y = 0.15 + h / 2;
    fire.add(f);
    return { f, h, seed: i * 2.1 };
  });
  const fireLight = new THREE.PointLight(color('--amber'), 22, 22, 1.6);
  fireLight.position.set(0, 1.2, 0);
  if (!small) { fireLight.castShadow = true; fireLight.shadow.mapSize.set(512, 512); fireLight.shadow.bias = -0.002; }
  scene.add(fireLight);
  // Embers rising out of the fire
  const EMBERS = 60;
  const emberPos = new Float32Array(EMBERS * 3);
  const embers = Array.from({ length: EMBERS }, () => ({ x: 0, y: rand() * 3, z: 0, vx: 0, vz: 0, vy: 0 }));
  const resetEmber = (e) => { e.x = (rand() - 0.5) * 0.5; e.z = (rand() - 0.5) * 0.5; e.y = 0.4; e.vx = (rand() - 0.5) * 0.3; e.vz = (rand() - 0.5) * 0.3; e.vy = 0.8 + rand() * 1.4; };
  embers.forEach(resetEmber);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberPts = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: color('--amber'), size: 3, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(emberPts);
  let stoked = 0;
  live((t, dt) => {
    const m = motion();
    flames.forEach(({ f, seed: s }) => {
      const n = m ? Math.sin(t * 0.013 + s) * 0.5 + Math.sin(t * 0.031 + s * 3) * 0.3 : 0;
      f.scale.set(1 + n * 0.08, 1 + n * 0.22 + stoked * 0.6, 1 + n * 0.08);
      f.rotation.y = m ? t * 0.002 + s : 0;
    });
    fireLight.intensity = (22 + stoked * 20) * (m ? 0.85 + 0.15 * Math.sin(t * 0.017) * Math.sin(t * 0.007) + 0.05 * Math.random() : 1);
    stoked = Math.max(0, stoked - dt * 0.6);
    embers.forEach((e, i) => {
      if (m) {
        e.x += e.vx * dt + Math.sin(t * 0.002 + i) * dt * 0.2; e.z += e.vz * dt; e.y += e.vy * dt * (1 + stoked);
        if (e.y > 4.5) resetEmber(e);
      }
      emberPos[i * 3] = e.x; emberPos[i * 3 + 1] = e.y; emberPos[i * 3 + 2] = e.z;
    });
    emberGeo.attributes.position.needsUpdate = true;
  });

  // Logs to sit on
  const seatLog = (x, z, ry) => {
    const l = mesh(new THREE.CylinderGeometry(0.3, 0.32, 2.6, 10), barkM, x, 0.3, z);
    l.rotation.set(0, ry, Math.PI / 2);
    mesh(new THREE.CircleGeometry(0.28, 10), mat('--earth-sand', 1, 0), 0, 1.31, 0, l).rotation.x = -Math.PI / 2;   // cut end
  };
  seatLog(-2.4, 0.9, 0.5);
  seatLog(0.6, -2.6, -0.1);
  // A mug left on the log
  mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 12), mat('--bebop-red', 0.6, 0.1), -2.2, 0.68, 1.15);

  /* ---------- Tent ---------- */

  const tentShape = new THREE.Shape([new THREE.Vector2(-1.3, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0, 1.7)]);
  const tent = new THREE.Mesh(new THREE.ExtrudeGeometry(tentShape, { depth: 2.6, bevelEnabled: false }), mat('--rug-teal', 0.95, 0, { side: THREE.DoubleSide }));
  add(tent);
  tent.position.set(-6.2, 0, -5.4);
  tent.rotation.y = 0.55;
  const door = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.55, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0, 1.0)])), new THREE.MeshBasicMaterial({ color: color('--space-black') }));
  door.position.set(0, 0.01, 2.61);
  tent.add(door);

  /* ---------- The CRT on a crate: the signal home ---------- */

  const crt = new THREE.Group();
  box(1.0, 0.62, 0.8, mat('--rail', 0.8, 0.2), 0, 0.31, 0, crt);   // crate
  const shell = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.82, 0.32, 3, 0.06), mat('--crt-shell', 0.5, 0.05));
  shell.position.set(0, 1.04, 0);
  add(shell, crt);
  const back = mesh(new THREE.CylinderGeometry(0.34, 0.52, 0.5, 4, 1), mat('--crt-shell', 0.55, 0.05, { flatShading: true }), 0, 1.04, -0.4, crt);
  back.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = 320; crtCanvas.height = 240;
  const crtTex = new THREE.CanvasTexture(crtCanvas);
  crtTex.colorSpace = THREE.SRGBColorSpace;
  const crtScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.57), new THREE.MeshBasicMaterial({ map: crtTex, toneMapped: false }));
  crtScreen.position.set(0, 1.07, 0.165);
  crt.add(crtScreen);
  crt.position.set(2.7, 0, 1.6);
  crt.rotation.y = -0.35;
  scene.add(crt);
  const crtGlow = new THREE.PointLight(color('--neon'), small ? 0 : 2.5, 4, 2);
  crtGlow.position.set(2.5, 1.2, 2.2);
  scene.add(crtGlow);
  let crtHot = false;
  const drawCrt = (t) => {
    const g = crtCanvas.getContext('2d');
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, 320, 240);
    g.fillStyle = token('--neon'); g.font = '26px VT323, monospace';
    g.fillText('SIGNAL HOME', 20, 40);
    g.fillStyle = token('--ink-dim'); g.font = '18px VT323, monospace';
    g.fillText('EARTHSIDE / CAMP 01', 20, 64);
    // A carrier wave, stronger when you lean in
    g.strokeStyle = token('--neon'); g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= 280; x += 4) {
      const y = 130 + Math.sin(x * 0.06 + t * 0.006) * (16 + (crtHot ? 12 : 0)) * Math.sin(x * 0.012 + t * 0.001);
      if (x) g.lineTo(20 + x, y); else g.moveTo(20, y);
    }
    g.stroke();
    if (crtHot || Math.floor(t / 500) % 2) { g.fillStyle = token('--amber'); g.font = '22px VT323, monospace'; g.fillText('> OPEN A CHANNEL', 20, 210); }
    g.fillStyle = token('--screen-scan');
    for (let y = 0; y < 240; y += 3) g.fillRect(0, y, 320, 1);
    crtTex.needsUpdate = true;
  };

  /* ---------- The ship, docked on its legs, nose toward the fire ---------- */

  const { ship, thrusters, hits: shipHits } = buildShip({ color, token, canvasTexture, small });
  ship.position.set(6.2, 0, -10.5);
  ship.rotation.y = -2.2;   // nose toward the camera and the fire, three-quarter on so her length shows
  scene.add(ship);
  const landed = ship.position.y;

  // Dust kicked up on touchdown
  const DUST = 50;
  const dustPos = new Float32Array(DUST * 3);
  const dust = Array.from({ length: DUST }, () => ({ x: 0, y: -10, z: 0, vx: 0, vz: 0, life: 0 }));
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: color('--earth-sand'), size: 0.35, transparent: true, opacity: 0.6, depthWrite: false });
  scene.add(new THREE.Points(dustGeo, dustMat));
  const kickDust = () => dust.forEach((d) => {
    const a = rand() * Math.PI * 2, v = 2 + rand() * 4;
    Object.assign(d, { x: ship.position.x + Math.cos(a) * 1.5, y: 0.2 + rand() * 0.4, z: ship.position.z + Math.sin(a) * 1.5, vx: Math.cos(a) * v, vz: Math.sin(a) * v, life: 1 });
  });
  live((t, dt) => {
    dust.forEach((d, i) => {
      if (d.life > 0) { d.life -= dt * 0.7; d.x += d.vx * dt; d.z += d.vz * dt; d.vx *= 0.96; d.vz *= 0.96; d.y += dt * 0.3; }
      dustPos[i * 3] = d.x; dustPos[i * 3 + 1] = d.life > 0 ? d.y : -10; dustPos[i * 3 + 2] = d.z;
    });
    dustGeo.attributes.position.needsUpdate = true;
  });

  // Coming down and going up: 0 is landed, 1 is high above the trees
  let flight = null;   // { from, to, t0, dur }
  let height = 0;
  const setHeight = (h) => {
    height = h;
    ship.position.y = landed + h * 30;
    ship.rotation.z = Math.sin(h * 6) * 0.04;
  };
  live((t) => {
    if (flight) {
      const p = Math.min(1, (t - flight.t0) / flight.dur);
      const k = flight.to > flight.from ? p * p : 1 - Math.pow(1 - p, 3);   // lift off accelerates; landing settles
      setHeight(flight.from + (flight.to - flight.from) * k);
      if (p >= 1) {
        if (flight.to === 0) kickDust();
        flight = null;
      }
    }
    const burn = flight ? 1 : 0;
    thrusters.forEach((c, i) => {
      c.visible = burn > 0;
      c.scale.y = 0.8 + (motion() ? Math.sin(t * 0.05 + i) * 0.2 : 0);
    });
  });

  /* ---------- Fireflies ---------- */

  const FLIES = small ? 18 : 36;
  const flyPos = new Float32Array(FLIES * 3);
  const flies = Array.from({ length: FLIES }, () => ({ a: rand() * Math.PI * 2, r: 3 + rand() * 7, y: 0.5 + rand() * 2.2, s: 0.2 + rand() * 0.4, p: rand() * 10 }));
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flyMat = new THREE.PointsMaterial({ color: color('--neon'), size: 3, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(flyGeo, flyMat));
  live((t, dt) => {
    flies.forEach((f, i) => {
      if (motion()) { f.a += dt * f.s * 0.3; f.p += dt; }
      flyPos[i * 3] = Math.cos(f.a) * f.r + Math.sin(f.p * 1.3) * 0.4;
      flyPos[i * 3 + 1] = f.y + Math.sin(f.p * 0.9) * 0.3;
      flyPos[i * 3 + 2] = Math.sin(f.a) * f.r;
    });
    flyGeo.attributes.position.needsUpdate = true;
    flyMat.opacity = motion() ? 0.55 + 0.45 * Math.sin(t * 0.004) : 0.8;
  });

  const crtHits = [shell, crtScreen];
  const fireHits = flames.map((f) => f.f);
  return {
    scene,
    crtScreen,
    hits: { crt: crtHits, fire: fireHits, ship: shipHits },
    // Where the camera rests: across the fire, with the ship behind
    pose(portrait) {
      return portrait
        ? { pos: V(3.5, 7.2, 14.5), target: V(1.6, 1.4, -3.0) }
        : { pos: V(9.5, 4.4, 10.5), target: V(1.6, 1.4, -2.6) };
    },
    focusCrt: crt,
    update(t, dt) { updaters.forEach((fn) => fn(t, dt)); },
    redraw(t) { drawCrt(t); },
    setCrtHot(v) { crtHot = v; },
    stoke() { stoked = 1; embers.forEach((e) => { e.vy *= 1.6; }); },
    // Touch down from above the trees, or lift back up into the sky
    land(dur = 4200) { setHeight(1); flight = { from: 1, to: 0, t0: performance.now(), dur }; },
    liftOff(dur = 2600) { flight = { from: height, to: 1, t0: performance.now(), dur }; },
    resetLanded() { flight = null; setHeight(0); },
  };
}
