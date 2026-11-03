import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ==========================================================
   The lounge itself: hull, a side viewport onto hyperspace, the cockpit door, rugs,
   furniture, lamps, a ceiling fan light, and the ship's corgi.
   Everything is built in code. Returns per-frame updaters.
   ========================================================== */

export function buildWorld({ scene, renderer, token, color, box, rbox, rod, canvasTexture, small, motion }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const updaters = [];
  const live = (fn) => updaters.push(fn);

  // Soft studio reflections so the metal reads as metal
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const mat = (name, rough = 0.8, metal = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, envMapIntensity: 0.35, ...extra });
  const glow = (name) => new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });
  const add = (mesh, parent = scene) => { mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = scene) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return add(o, parent); };
  const lamp = (name, intensity, dist, x, y, z) => {
    if (small) return null;            // phones: the emissive bulbs carry the look on their own
    const l = new THREE.PointLight(color(name), intensity, dist, 2);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  };

  const hullDark = mat('--hull-dark', 0.45, 0.7);
  const hullMid = mat('--hull-mid', 0.4, 0.75);
  const railMat = mat('--rail', 0.45, 0.6);
  const couchMat = mat('--couch', 0.85, 0.0, { envMapIntensity: 0.15 });
  const couchShade = mat('--couch-shade', 0.9, 0.0, { envMapIntensity: 0.15 });
  const warm = glow('--lamp-warm');
  const red = glow('--bebop-red');
  const cyan = glow('--neon-cyan');
  const amberGlow = glow('--amber');

  /* ---------- Textures ---------- */

  const deckTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = token('--deck'); g.fillRect(0, 0, w, h);
    // Plates with slightly different tones so the floor isn't one flat sheet
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = (x * 3 + y) % 4 === 0 ? token('--deck-alt') : token('--deck');
      g.fillRect(x * 128, y * 128, 128, 128);
    }
    g.strokeStyle = token('--deck-line'); g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke();
    }
    g.fillStyle = token('--deck-line');
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      [[10, 10], [118, 10], [10, 118], [118, 118]].forEach(([dx, dy]) => { g.beginPath(); g.arc(x * 128 + dx, y * 128 + dy, 3.5, 0, 6.283); g.fill(); });
      if ((x + y) % 3 === 0) {
        g.lineWidth = 2;
        for (let k = 20; k < 120; k += 12) { g.beginPath(); g.moveTo(x * 128 + k, y * 128 + 20); g.lineTo(x * 128 + k - 8, y * 128 + 108); g.stroke(); }
        g.lineWidth = 4;
      }
    }
  }, [5, 4]);

  const wallTex = canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = token('--wall'); g.fillRect(0, 0, w, h);
    g.strokeStyle = token('--deck-line'); g.lineWidth = 3;
    for (let x = 0; x < w; x += 128) {
      g.strokeRect(x + 6, 10, 116, h - 20);
      g.fillStyle = token('--deck-line');
      for (let y = 22; y < h - 12; y += 40) { g.beginPath(); g.arc(x + 14, y, 2.5, 0, 6.283); g.fill(); g.beginPath(); g.arc(x + 114, y, 2.5, 0, 6.283); g.fill(); }
    }
    g.fillStyle = token('--deck'); g.fillRect(0, h * 0.62, w, 10);
  });

  const grateTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = token('--space-black'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--hull-dark');
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 32) g.fillRect(x + 2, y + 2, 28, 10);
  }, [2, 12]);

  const hazardTex = canvasTexture(128, 32, (g, w, h) => {
    g.fillStyle = token('--space-black'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--amber');
    for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  }, [4, 1]);

  // A woven rug: border bands and a row of stepped diamonds
  const rugTex = (bg, a, b, c) => canvasTexture(256, 384, (g, w, h) => {
    g.fillStyle = token(bg); g.fillRect(0, 0, w, h);
    g.fillStyle = token(a); g.fillRect(10, 10, w - 20, h - 20);
    g.fillStyle = token(bg); g.fillRect(22, 22, w - 44, h - 44);
    g.fillStyle = token(c);
    for (let y = 30; y < h - 30; y += 12) { g.fillRect(14, y, 4, 6); g.fillRect(w - 18, y, 4, 6); }
    for (let k = 0; k < 4; k++) {
      const cy = 70 + k * 82, cx = w / 2;
      for (let s = 5; s > 0; s--) {
        g.fillStyle = token(s % 2 ? b : a);
        const r = s * 11;
        g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * 1.4, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 1.4, cy); g.closePath(); g.fill();
      }
    }
    // Wear: a little speckle so it reads as cloth
    g.fillStyle = token('--rug-wear');
    for (let i = 0; i < 1400; i++) g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  });

  /* ---------- Hull: floor, walls with a viewport ---------- */

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.55, metalness: 0.55, envMapIntensity: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Grated strips along both side walls, hazard edging at the stair foot
  const flat = (w, d, m, x, z, y = 0.004) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; scene.add(p); return p;
  };
  const grateMat = new THREE.MeshStandardMaterial({ map: grateTex, roughness: 0.5, metalness: 0.7, envMapIntensity: 0.4 });
  flat(1.1, 13, grateMat, -7.45, 0.5);
  flat(1.1, 13, grateMat, 7.45, 0.5);
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.7 });
  flat(1.9, 0.22, hazard, 2.3, -1.95, 0.006);
  flat(5.6, 0.22, hazard, -4.0, -6.2, 0.006);

  const wallMat = (w, h) => {
    const t = wallTex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 4, h / 4);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.5, envMapIntensity: 0.25 });
  };
  const wall = (w, h, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat(w, h));
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m;
  };
  // Back wall, built around the cockpit door at the top of the stairs (x 1.3..3.3, y 3.03..5.65)
  const WZ = -6.5;
  wall(9.3, 8, -3.35, 4, WZ);
  wall(4.7, 8, 5.65, 4, WZ);
  wall(2.0, 3.03, 2.3, 1.515, WZ);
  wall(2.0, 2.35, 2.3, 6.825, WZ);

  // Left wall, built around the viewport over the gaming corner (z -5.8..-1.0, y 1.9..4.8)
  const vz0 = -5.8, vz1 = -1.0, vy0 = 1.9, vy1 = 4.8, vzc = (vz0 + vz1) / 2, vyc = (vy0 + vy1) / 2, vlen = vz1 - vz0, vh = vy1 - vy0;
  wall(0.7, 8, -8, 4, -6.15, Math.PI / 2);
  wall(9.5, 8, -8, 4, 3.75, Math.PI / 2);
  wall(vlen, vy0, -8, vy0 / 2, vzc, Math.PI / 2);
  wall(vlen, 8 - vy1, -8, (8 + vy1) / 2, vzc, Math.PI / 2);
  wall(15, 8, 8, 4, 1, -Math.PI / 2);
  // Ceiling and front wall close the room. Both face inward only, so from the
  // cutaway camera outside they vanish, but looking back from the stairs or the
  // cockpit door the lounge is a sealed compartment, not an open box in space.
  const lid = wall(16, 14, 0, 8, 0.5);
  lid.rotation.set(Math.PI / 2, 0, 0);
  wall(16, 8, 0, 4, 7.5, Math.PI);
  // A run of ceiling lights so the lid isn't a blank slab from below
  [-4, 0, 4].forEach((x) => box(0.9, 0.05, 6, warm, x, 7.96, 0.5).castShadow = false);

  // Viewport frame: heavy bars, mullions, bolts, a cyan sill light
  box(0.4, 0.28, vlen + 0.5, hullMid, -7.85, vy1 + 0.1, vzc);
  box(0.5, 0.32, vlen + 0.5, hullMid, -7.8, vy0 - 0.1, vzc);
  box(0.4, vh + 0.5, 0.28, hullMid, -7.85, vyc, vz0 - 0.1);
  box(0.4, vh + 0.5, 0.28, hullMid, -7.85, vyc, vz1 + 0.1);
  box(0.18, vh, 0.12, hullDark, -7.95, vyc, vzc);
  box(0.18, 0.1, vlen, hullDark, -7.95, vyc + 0.35, vzc);
  for (let z = vz0 + 0.2; z <= vz1 - 0.1; z += 0.6) {
    mesh(new THREE.SphereGeometry(0.045, 8, 6), hullDark, -7.64, vy1 + 0.1, z);
    mesh(new THREE.SphereGeometry(0.045, 8, 6), hullDark, -7.54, vy0 - 0.1, z);
  }
  box(0.04, 0.04, vlen - 0.2, cyan, -7.54, vy0 + 0.08, vzc).castShadow = false;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(vlen, vh), new THREE.MeshBasicMaterial({ color: color('--atmo'), transparent: true, opacity: 0.05, depthWrite: false }));
  glass.position.set(-7.98, vyc, vzc);
  glass.rotation.y = Math.PI / 2;
  scene.add(glass);

  // Cool light falling in through the viewport
  if (!small) {
    const shaft = new THREE.SpotLight(color('--atmo'), 45, 14, 0.6, 0.8, 1.6);
    shaft.position.set(-8.6, vyc + 0.4, vzc);
    shaft.target.position.set(-4.5, 0, -2.6);
    scene.add(shaft, shaft.target);
  }

  /* ---------- The cockpit door: two panels that slide into the wall ---------- */

  const doorY = 4.34;
  box(2.5, 0.25, 0.3, hullMid, 2.3, 5.78, WZ + 0.1);
  box(0.25, 2.9, 0.3, hullMid, 1.17, doorY, WZ + 0.1);
  box(0.25, 2.9, 0.3, hullMid, 3.43, doorY, WZ + 0.1);
  box(1.6, 0.05, 0.05, cyan, 2.3, 5.95, WZ + 0.2).castShadow = false;
  const doorLampMat = new THREE.MeshBasicMaterial({ color: color('--bebop-red'), toneMapped: false });
  box(0.3, 0.1, 0.05, doorLampMat, 2.3, 6.12, WZ + 0.2).castShadow = false;
  const panelFace = mat('--panel-door', 0.4, 0.7);
  const panels = [-1, 1].map((side) => {
    const p = new THREE.Group();
    box(1.0, 2.62, 0.1, panelFace, 0, 0, 0, p);
    box(0.7, 1.0, 0.03, hullDark, 0, 0.55, 0.06, p);
    box(0.7, 0.7, 0.03, hullDark, 0, -0.55, 0.06, p);
    box(0.06, 0.6, 0.02, cyan, side * -0.42, 0.55, 0.08, p).castShadow = false;
    box(1.0, 0.07, 0.02, amberGlow, 0, 0, 0.07, p).castShadow = false;
    p.position.set(2.3 + side * 0.5, doorY, WZ - 0.08);
    p.userData.closedX = p.position.x;
    p.userData.side = side;
    scene.add(p);
    return p;
  });
  const doorHits = [];
  panels.forEach((p) => p.traverse((o) => { if (o.isMesh) doorHits.push(o); }));
  // An invisible, generous hit area over the whole doorway and frame
  const doorPad = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.4), new THREE.MeshBasicMaterial({ visible: false }));
  doorPad.position.set(2.3, doorY + 0.15, WZ + 0.3);
  scene.add(doorPad);
  doorHits.push(doorPad);
  let doorOpen = 0, doorGoal = 0;
  live((t, dt) => {
    doorOpen += Math.sign(doorGoal - doorOpen) * Math.min(Math.abs(doorGoal - doorOpen), dt / (motion() ? 0.8 : 0.01));
    const k = doorOpen < 0.5 ? 2 * doorOpen * doorOpen : 1 - Math.pow(-2 * doorOpen + 2, 2) / 2;
    panels.forEach((p) => { p.position.x = p.userData.closedX + p.userData.side * k * 0.98; });
    doorLampMat.color.copy(color(doorOpen > 0.5 ? '--neon' : '--bebop-red'));
  });

  /* ---------- Pipes, conduit, neon ---------- */

  rod(V(-8, 6.0, -6.2), V(8, 6.0, -6.2), 0.09, railMat);
  rod(V(-8, 6.35, -6.15), V(8, 6.35, -6.15), 0.06, hullMid);
  [5.4, 5.6, 5.8].forEach((y, i) => rod(V(-7.85, y, -6.5), V(-7.85, y, 6), 0.05 + i * 0.015, i === 1 ? railMat : hullDark));
  rod(V(7.85, 0, -6.2), V(7.85, 7, -6.2), 0.12, railMat);
  rod(V(-0.7, 0, -6.3), V(-0.7, 7, -6.3), 0.08, hullMid);
  box(9.0, 0.05, 0.05, amberGlow, 3.4, 0.08, WZ + 0.06).castShadow = false;       // floor-line neon on the back wall
  box(0.05, 0.05, 12, cyan, -7.9, 0.08, 0.5).castShadow = false;
  box(4.0, 0.12, 0.12, warm, 4.5, 5.2, WZ + 0.15).castShadow = false;             // the old strip light, now over the bed

  /* ---------- Deck plate, rugs ---------- */

  const plate = new THREE.Shape();
  plate.moveTo(-1.4, -1.6); plate.lineTo(1.4, -1.6); plate.lineTo(1.7, 1.0); plate.lineTo(0, 2.1); plate.lineTo(-1.7, 1.0); plate.closePath();
  const plateMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(plate, { depth: 0.08, bevelEnabled: false }), hullDark);
  plateMesh.rotation.x = -Math.PI / 2;
  plateMesh.position.set(0, 0, 1.4);
  plateMesh.receiveShadow = true;
  scene.add(plateMesh);

  const rugA = new THREE.MeshStandardMaterial({ map: rugTex('--rug-red', '--amber', '--cream', '--paper-ink'), roughness: 1, envMapIntensity: 0.1 });
  const rugB = new THREE.MeshStandardMaterial({ map: rugTex('--rug-teal', '--cream', '--amber', '--paper-ink'), roughness: 1, envMapIntensity: 0.1 });
  const rug1 = flat(3.0, 4.6, rugA, -3.3, 0.9, 0.01);
  rug1.rotation.z = 0.04;
  flat(2.2, 2.8, rugB, 4.6, -4.7, 0.01).rotation.z = Math.PI / 2;

  /* ---------- Couches and coffee table ---------- */

  const couch = (len, depth, x, z, ry) => {
    const g = new THREE.Group();
    box(depth, 0.36, len, couchShade, 0, 0.18, 0, g);
    const cush = len / 3;
    for (let i = 0; i < 3; i++) rbox(depth - 0.3, 0.22, cush - 0.05, 0.06, couchMat, 0.12, 0.47, -len / 2 + cush * (i + 0.5), g);
    rbox(0.34, 0.82, len, 0.08, couchMat, -depth / 2 + 0.17, 0.72, 0, g);
    rbox(depth, 0.56, 0.28, 0.06, couchMat, 0, 0.56, -len / 2 - 0.12, g);
    rbox(depth, 0.56, 0.28, 0.06, couchMat, 0, 0.56, len / 2 + 0.12, g);
    g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    return g;
  };
  couch(4.6, 1.3, -5.0, 0.8, 0);
  couch(2.6, 1.3, 5.0, 1.0, Math.PI);
  // A throw pillow on the long couch
  rbox(0.5, 0.42, 0.18, 0.08, mat('--rug-teal', 0.95, 0), -5.35, 0.78, 2.6).rotation.set(0.2, 0.9, 0.15);

  const table = new THREE.Group();
  rbox(1.05, 0.08, 2.0, 0.03, hullMid, 0, 0.5, 0, table);
  box(0.8, 0.44, 1.7, hullDark, 0, 0.24, 0, table);
  box(0.82, 0.02, 1.72, cyan, 0, 0.03, 0, table).castShadow = false;
  // A paperback and the coffee
  box(0.28, 0.04, 0.38, mat('--bebop-red', 0.9, 0), 0.15, 0.56, -0.5, table).rotation.y = 0.3;
  table.position.set(-3.3, 0, 0.9);
  scene.add(table);

  const mug = new THREE.Group();
  const mugMat = mat('--cream', 0.35, 0.05);
  mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.17, 20, 1, true), mugMat, 0, 0.085, 0, mug).material.side = THREE.DoubleSide;
  mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.01, 20), mugMat, 0, 0.005, 0, mug);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 20), mat('--coffee', 0.2, 0), 0, 0.15, 0, mug);
  const handle = mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16, Math.PI), mugMat, 0.08, 0.09, 0, mug);
  handle.rotation.z = -Math.PI / 2;
  mug.position.set(-3.15, 0.54, 1.35);
  scene.add(mug);

  // Steam: soft sprites rising, swaying and thinning out
  const steamTex = canvasTexture(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, token('--steam'));
    r.addColorStop(1, 'transparent');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const puffs = [0, 0.33, 0.66].map((offset) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    scene.add(s);
    return { s, offset };
  });
  live((t) => {
    puffs.forEach(({ s, offset }) => {
      const p = motion() ? (t * 0.00035 + offset) % 1 : offset;
      s.position.set(mug.position.x + Math.sin(p * 6 + offset * 9) * 0.05, mug.position.y + 0.18 + p * 0.75, mug.position.z);
      const sc = 0.12 + p * 0.38;
      s.scale.set(sc, sc * 1.4, 1);
      s.material.opacity = Math.sin(p * Math.PI) * 0.5;
    });
  });

  /* ---------- Stairs, landing, bulkhead door, crate ---------- */

  const steps = 9, rise = 0.33, run = 0.36, sx = 2.3, sz = -2.3;
  for (let i = 0; i < steps; i++) {
    box(1.8, 0.07, 0.38, hullMid, sx, rise * (i + 1), sz - run * i);
    box(1.8, 0.02, 0.04, amberGlow, sx, rise * (i + 1) + 0.04, sz - run * i + 0.17).castShadow = false;
  }
  const topY = rise * steps, topZ = sz - run * (steps - 1);
  [-0.95, 0.95].forEach((dx) => {
    rod(V(sx + dx, 0, sz + 0.2), V(sx + dx, topY, topZ - 0.2), 0.05, hullDark);
    rod(V(sx + dx, 1.0, sz + 0.2), V(sx + dx, topY + 1.0, topZ - 0.2), 0.04, railMat);
    [0, 4, 8].forEach((k) => rod(V(sx + dx, rise * (k + 1), sz - run * k), V(sx + dx, rise * (k + 1) + 1.0, sz - run * k), 0.025, railMat));
  });
  box(3.4, 0.12, 1.5, hullMid, 2.25, topY, topZ - 0.9);
  rod(V(0.55, topY + 1.0, topZ - 0.2), V(3.95, topY + 1.0, topZ - 0.2), 0.04, railMat);
  rod(V(0.55, topY + 0.5, topZ - 0.2), V(3.95, topY + 0.5, topZ - 0.2), 0.025, railMat);
  for (let x = 0.55; x <= 3.96; x += 0.85) rod(V(x, topY, topZ - 0.2), V(x, topY + 1.0, topZ - 0.2), 0.025, railMat);

  const door = new THREE.Group();
  rbox(2.4, 3.4, 0.2, 0.1, hullMid, 0, 1.7, 0, door);
  box(1.9, 2.9, 0.1, hullDark, 0, 1.7, 0.1, door);
  box(1.9, 0.08, 0.02, mat('--amber', 0.6, 0.2), 0, 1.7, 0.16, door);
  box(0.25, 0.12, 0.05, red, 0, 3.6, 0.12, door).castShadow = false;
  door.position.set(7.9, 0, -1.7);
  door.rotation.y = -Math.PI / 2;
  scene.add(door);

  box(1.3, 0.62, 1.0, hullDark, 0.0, 0.31, -2.2);              // crate for the fourth monitor
  // Stacked cargo by the door
  box(1.0, 0.7, 0.9, mat('--rail', 0.7, 0.3), 6.9, 0.35, 3.6);
  box(0.8, 0.55, 0.7, hullMid, 6.8, 0.98, 3.5).rotation.y = 0.3;

  // Wall terminal above the long couch: scrolling readout
  const termCanvas = document.createElement('canvas');
  termCanvas.width = 256; termCanvas.height = 160;
  const termTex = new THREE.CanvasTexture(termCanvas);
  termTex.colorSpace = THREE.SRGBColorSpace;
  const term = new THREE.Group();
  box(1.7, 1.15, 0.12, hullDark, 0, 0, 0, term);
  const termScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), new THREE.MeshBasicMaterial({ map: termTex, toneMapped: false }));
  termScreen.position.z = 0.07;
  term.add(termScreen);
  term.position.set(-7.92, 2.6, 0.8);
  term.rotation.y = Math.PI / 2;
  scene.add(term);
  const drawTerm = (t) => {
    const g = termCanvas.getContext('2d');
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, 256, 160);
    g.fillStyle = token('--amber'); g.font = '16px VT323, monospace';
    const off = Math.floor(t / 600);
    for (let i = 0; i < 8; i++) {
      const n = (off + i) * 2654435761 >>> 0;
      g.fillText(`${(n % 0xffff).toString(16).padStart(4, '0').toUpperCase()}  ${['NAV OK', 'O2 98%', 'HULL OK', 'COMMS', 'FUEL 64', 'GRAV 1.0'][n % 6]}`, 12, 22 + i * 18);
    }
    termTex.needsUpdate = true;
  };

  // Poster over the bed: an original gig bill
  const posterTex = canvasTexture(256, 360, (g, w, h) => {
    g.fillStyle = token('--bebop-red'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--amber'); g.beginPath(); g.arc(w / 2, 150, 80, 0, 6.283); g.fill();
    g.fillStyle = token('--paper-ink'); g.fillRect(0, 150, w, 6);
    g.fillStyle = token('--cream');
    g.font = 'bold 30px Syncopate, sans-serif'; g.fillText('LIVE', 24, 280); g.fillText('JAZZ', 24, 316);
    g.font = '18px "Share Tech Mono", monospace'; g.fillText('SESSION 26 / TONIGHT', 24, 344);
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.9 }));
  poster.position.set(7.95, 2.7, -4.6);
  poster.rotation.y = -Math.PI / 2;
  scene.add(poster);

  /* ---------- Bed in the back-right corner ---------- */

  const blanketTex = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = token('--blanket'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--cream');
    for (let y = 30; y < h; y += 56) { g.fillRect(0, y, w, 6); g.fillRect(0, y + 12, w, 3); }
  });
  const bed = new THREE.Group();
  box(2.4, 0.38, 3.3, hullDark, 0, 0.19, 0, bed);
  rbox(2.25, 0.3, 3.15, 0.1, mat('--cream', 0.95, 0), 0, 0.52, 0, bed);
  const blanket = rbox(2.4, 0.16, 2.2, 0.07, new THREE.MeshStandardMaterial({ map: blanketTex, roughness: 1, envMapIntensity: 0.1 }), 0, 0.66, 0.5, bed);
  blanket.rotation.x = 0.02;
  rbox(2.3, 0.22, 0.5, 0.08, new THREE.MeshStandardMaterial({ map: blanketTex, roughness: 1 }), 0.05, 0.74, -0.5, bed).rotation.set(0.2, 0.1, 0);   // the folded-back edge
  rbox(0.8, 0.2, 0.5, 0.1, mat('--bone', 1, 0), -0.55, 0.78, -1.25, bed);
  rbox(0.8, 0.2, 0.5, 0.1, mat('--bone', 1, 0), 0.5, 0.78, -1.3, bed).rotation.y = 0.12;
  box(2.4, 1.1, 0.12, hullMid, 0, 0.55, -1.7, bed);           // headboard
  bed.position.set(6.4, 0, -4.6);
  scene.add(bed);

  // Bedside crate and lamp
  box(0.7, 0.6, 0.6, mat('--rail', 0.7, 0.3), 4.6, 0.3, -5.8);
  const bedsideLamp = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.04, 0.1, 0.05, 16), hullMid, 0, 0.02, 0, bedsideLamp);
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8), hullMid, 0, 0.2, 0, bedsideLamp);
  mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 20, 1, true), mat('--lamp-shade', 0.9, 0, { side: THREE.DoubleSide, emissive: color('--lamp-warm'), emissiveIntensity: 0.6 }), 0, 0.42, 0, bedsideLamp);
  bedsideLamp.position.set(4.6, 0.6, -5.8);
  scene.add(bedsideLamp);
  lamp('--lamp-warm', 4, 5, 4.6, 1.15, -5.6);

  /* ---------- Gaming corner on the left wall ---------- */

  const gaming = new THREE.Group();
  box(1.0, 0.06, 2.6, hullMid, 0, 0.76, 0, gaming);
  [[-0.4, -1.2], [-0.4, 1.2], [0.4, -1.2], [0.4, 1.2]].forEach(([x, z]) => box(0.06, 0.74, 0.06, hullDark, x, 0.37, z, gaming));
  box(0.06, 0.04, 2.5, cyan, 0.49, 0.72, 0, gaming).castShadow = false;            // underglow

  const gameScreens = [0, 1].map((k) => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mon = new THREE.Group();
    box(0.05, 0.52, 0.9, mat('--space-black', 0.4, 0.6), 0, 0, 0, mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.48), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    scr.position.x = 0.03; scr.rotation.y = Math.PI / 2;
    mon.add(scr);
    box(0.04, 0.24, 0.04, hullDark, -0.04, -0.34, 0, mon);
    box(0.22, 0.02, 0.18, hullDark, -0.04, -0.46, 0, mon);
    mon.position.set(-0.25, 1.25, k ? 0.5 : -0.48);
    mon.rotation.y = k ? -0.25 : 0.25;
    gaming.add(mon);
    return { c, tex, k };
  });
  // Keyboard with a lit strip, mouse, headphones
  box(0.2, 0.03, 0.62, mat('--space-black', 0.5, 0.4), 0.18, 0.8, 0, gaming);
  box(0.16, 0.012, 0.58, glow('--neon'), 0.18, 0.818, 0, gaming).castShadow = false;
  mesh(new THREE.SphereGeometry(0.04, 12, 8), mat('--space-black', 0.4, 0.4), 0.2, 0.81, 0.48, gaming).scale.set(1, 0.5, 1.4);
  const phones = mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 20, Math.PI), mat('--bebop-red', 0.5, 0.3), 0.15, 0.82, -1.0, gaming);
  phones.rotation.set(Math.PI / 2, 0, 0.6);
  // PC tower with a lit side window
  const tower = new THREE.Group();
  box(0.5, 0.95, 0.9, mat('--space-black', 0.35, 0.7), 0, 0.475, 0, tower);
  box(0.02, 0.75, 0.7, glow('--neon-cyan'), 0.26, 0.5, 0, tower).castShadow = false;
  [0.3, 0.62].forEach((y) => { const f = mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 20), amberGlow, 0.275, y, 0.05, tower); f.rotation.y = Math.PI / 2; f.castShadow = false; });
  tower.position.set(-0.05, 0, -1.65);
  gaming.add(tower);
  // Gaming chair: seat, tall back, arms, five-star base
  const chair = new THREE.Group();
  const chairRed = mat('--bebop-red', 0.6, 0.1);
  const chairBlack = mat('--space-black', 0.55, 0.2);
  rbox(0.6, 0.12, 0.6, 0.05, chairBlack, 0, 0.5, 0, chair);
  rbox(0.12, 0.95, 0.58, 0.06, chairBlack, 0.3, 1.0, 0, chair).rotation.z = -0.12;
  box(0.13, 0.85, 0.14, chairRed, 0.31, 1.0, 0, chair).rotation.z = -0.12;
  [-0.32, 0.32].forEach((z) => box(0.4, 0.05, 0.06, chairBlack, 0, 0.72, z, chair));
  rod(V(0, 0.08, 0), V(0, 0.45, 0), 0.03, hullMid, chair);
  for (let k = 0; k < 5; k++) { const a = k * 1.2566; rod(V(0, 0.08, 0), V(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3), 0.02, hullDark, chair); }
  chair.position.set(1.0, 0, 0.1);
  chair.rotation.y = 0.35;
  gaming.add(chair);
  gaming.position.set(-7.4, 0, -4.2);
  scene.add(gaming);
  lamp('--neon-cyan', 3, 4, -6.6, 1.4, -4.2);

  const drawGame = (g, k, t) => {
    const W = 320, H = 180, s = t / 1000;
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, W, H);
    if (!k) {
      // Arena: perspective grid, a target, health and ammo
      g.strokeStyle = token('--neon-cyan'); g.globalAlpha = 0.5; g.lineWidth = 1;
      for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(W / 2 + i * 8, 90); g.lineTo(W / 2 + i * 40, H); g.stroke(); }
      for (let y = 95; y < H; y += (y - 85) * 0.35) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.globalAlpha = 1;
      const tx = W / 2 + Math.sin(s * 1.3) * 90, ty = 70 + Math.cos(s * 0.9) * 12;
      g.fillStyle = token('--bebop-red'); g.fillRect(tx - 6, ty - 14, 12, 28);
      g.strokeStyle = token('--neon'); g.lineWidth = 2;
      g.beginPath(); g.moveTo(W / 2 - 10, 90); g.lineTo(W / 2 + 10, 90); g.moveTo(W / 2, 80); g.lineTo(W / 2, 100); g.stroke();
      g.fillStyle = token('--amber'); g.fillRect(12, H - 20, 90 + Math.sin(s) * 10, 8);
      g.font = '18px VT323, monospace'; g.fillText('24 / 90', W - 70, H - 12);
      g.strokeStyle = token('--neon'); g.beginPath(); g.arc(W - 30, 28, 20, 0, 6.283); g.stroke();
    } else {
      // Stream chat scrolling past, with a live dot
      g.fillStyle = token('--bebop-red'); g.beginPath(); g.arc(18, 16, 6, 0, 6.283); g.fill();
      g.fillStyle = token('--cream'); g.font = '16px VT323, monospace'; g.fillText('LIVE', 30, 21);
      const off = (s * 18) % 20;
      for (let i = 0; i < 9; i++) {
        const y = 48 + i * 20 - off;
        if (y < 34) continue;
        g.fillStyle = token(i % 3 ? '--neon' : '--amber');
        g.fillRect(12, y - 8, 40, 6);
        g.fillStyle = token('--ink-dim');
        g.fillRect(58, y - 8, 60 + ((i * 53 + Math.floor(s * 0.9)) % 150), 6);
      }
    }
  };

  /* ---------- Lamps and the hanging lantern ---------- */

  const floorLamp = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 20), hullDark, 0, 0.02, 0, floorLamp);
  rod(V(0, 0, 0), V(0, 1.55, 0), 0.025, railMat, floorLamp);
  mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.42, 24, 1, true), mat('--lamp-shade', 0.9, 0, { side: THREE.DoubleSide, emissive: color('--lamp-warm'), emissiveIntensity: 0.7 }), 0, 1.65, 0, floorLamp);
  mesh(new THREE.SphereGeometry(0.07, 12, 8), warm, 0, 1.6, 0, floorLamp).castShadow = false;
  floorLamp.position.set(-5.55, 0, 3.75);
  scene.add(floorLamp);
  lamp('--lamp-warm', 9, 7, -5.55, 1.6, 3.75);

  const lantern = new THREE.Group();
  rod(V(0, 0, 0), V(0, 3.2, 0), 0.012, hullDark, lantern);
  mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 6, 1, true), mat('--lamp-shade', 0.8, 0, { side: THREE.DoubleSide, emissive: color('--amber'), emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }), 0, -0.2, 0, lantern);
  mesh(new THREE.CylinderGeometry(0.08, 0.17, 0.08, 6), hullDark, 0, 0.04, 0, lantern);
  mesh(new THREE.CylinderGeometry(0.17, 0.08, 0.06, 6), hullDark, 0, -0.44, 0, lantern);
  lantern.position.set(0.7, 3.9, -3.7);
  scene.add(lantern);
  const lanternLight = lamp('--amber', 7, 6, 0.7, 3.6, -3.7);
  live((t) => {
    if (!motion()) return;
    lantern.rotation.z = Math.sin(t * 0.0009) * 0.04;
    if (lanternLight) lanternLight.intensity = 7 + Math.sin(t * 0.017) * 0.6 + Math.sin(t * 0.041) * 0.4;
  });

  /* ---------- Ceiling fan light ---------- */

  const fan = new THREE.Group();
  rod(V(0, 0, 0), V(0, 1.4, 0), 0.03, hullDark, fan);
  mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 16), hullMid, 0, -0.05, 0, fan);
  mesh(new THREE.SphereGeometry(0.12, 16, 10), glow('--fan-light'), 0, -0.16, 0, fan).castShadow = false;
  const blades = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const b = box(1.5, 0.025, 0.2, mat('--rug-teal', 0.6, 0.4), 0.85, 0, 0, blades);
    b.parent.remove(b);
    const arm = new THREE.Group();
    arm.add(b);
    b.rotation.x = 0.18;
    arm.rotation.y = k * Math.PI / 2;
    blades.add(arm);
  }
  blades.position.y = 0.02;
  fan.add(blades);
  // A soft cone of light under the fan
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.0, 32, 1, true), new THREE.MeshBasicMaterial({ color: color('--fan-light'), transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.y = -2.6;
  fan.add(cone);
  fan.position.set(-1.9, 5.4, -2.6);
  scene.add(fan);
  const fanLight = new THREE.SpotLight(color('--fan-light'), small ? 18 : 32, 12, 0.6, 0.75, 1.6);
  fanLight.position.set(-1.9, 5.2, -2.6);
  fanLight.target.position.set(-1.9, 0, -2.2);
  scene.add(fanLight, fanLight.target);
  live((t, dt) => { if (motion()) blades.rotation.y += dt * 2.4; });

  /* ---------- Lights ---------- */

  scene.add(new THREE.HemisphereLight(color('--atmo'), color('--soot'), 0.28));
  const sun = new THREE.DirectionalLight(color('--lamp-warm'), 0.9);
  sun.position.set(3, 11, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  lamp('--lamp-warm', 14, 10, 4.5, 4.6, -5.6);

  /* ---------- The ship's corgi ---------- */

  const dog = new THREE.Group();
  const fur = mat('--corgi', 0.9, 0, { envMapIntensity: 0.1 });
  const furDark = mat('--corgi-dark', 0.9, 0, { envMapIntensity: 0.1 });
  const white = mat('--cream', 0.95, 0, { envMapIntensity: 0.1 });
  const ink = mat('--paper-ink', 0.3, 0.2);
  const body = mesh(new THREE.CapsuleGeometry(0.17, 0.44, 6, 14), fur, 0, 0.19, 0, dog);
  body.rotation.z = Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.15, 16, 12), white, 0.2, 0.15, 0, dog).scale.set(1.05, 0.85, 1.0);
  // Legs: front paws stretched out, back legs tucked
  [-0.09, 0.09].forEach((z) => {
    const leg = mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), fur, 0.36, 0.05, z, dog);
    leg.rotation.z = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.05, 10, 8), white, 0.5, 0.045, z, dog);
    mesh(new THREE.SphereGeometry(0.1, 12, 10), fur, -0.27, 0.13, z * 1.5, dog);
    mesh(new THREE.SphereGeometry(0.045, 10, 8), white, -0.14, 0.04, z * 1.9, dog).scale.set(1.5, 0.8, 1);
  });
  // Tail stub on a pivot so it can wag
  const tail = new THREE.Group();
  tail.position.set(-0.42, 0.24, 0);
  mesh(new THREE.SphereGeometry(0.06, 10, 8), furDark, -0.03, 0.02, 0, tail);
  dog.add(tail);
  // Collar and tag
  const collar = mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 24), mat('--bebop-red', 0.5, 0.2), 0.27, 0.3, 0, dog);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0.35;
  mesh(new THREE.SphereGeometry(0.03, 10, 8), mat('--amber', 0.3, 0.8), 0.33, 0.18, 0, dog);
  // Head on a neck pivot: skull, white blaze and muzzle, nose, eyes, ears
  const head = new THREE.Group();
  head.position.set(0.32, 0.33, 0);
  mesh(new THREE.SphereGeometry(0.155, 18, 14), fur, 0.1, 0.02, 0, head).scale.set(1.05, 0.95, 1.05);
  mesh(new THREE.SphereGeometry(0.07, 12, 10), white, 0.21, 0.06, 0, head).scale.set(0.5, 1.2, 0.6);
  const muzzle = mesh(new THREE.CapsuleGeometry(0.068, 0.09, 4, 10), white, 0.24, -0.04, 0, head);
  muzzle.rotation.z = Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.032, 10, 8), ink, 0.34, -0.03, 0, head);
  [-0.075, 0.075].forEach((z) => mesh(new THREE.SphereGeometry(0.026, 10, 8), ink, 0.245, 0.065, z, head));
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    ear.position.set(0.04, 0.12, side * 0.085);
    mesh(new THREE.ConeGeometry(0.07, 0.18, 10), fur, 0, 0.08, 0, ear);
    mesh(new THREE.ConeGeometry(0.04, 0.12, 8), white, 0.025, 0.06, 0, ear);
    ear.rotation.x = side * 0.32;
    head.add(ear);
    return ear;
  });
  const tongue = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.035), mat('--bebop-red', 0.6, 0), 0.3, -0.1, 0, head);
  tongue.visible = false;
  dog.add(head);
  dog.scale.setScalar(1.35);
  dog.position.set(2.2, 0, 3.1);
  dog.rotation.y = -1.9;             // facing the room, towards the camera
  scene.add(dog);

  // Bowls: food and water
  const bowlMat = mat('--bowl', 0.35, 0.3);
  const bowl = (x, z, fill) => {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.09, 24, 1, true), bowlMat, 0, 0.045, 0, g).material.side = THREE.DoubleSide;
    mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 24), bowlMat, 0, 0.005, 0, g);
    if (fill === 'water') mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.01, 24), mat('--earth-shallow', 0.05, 0.1, { transparent: true, opacity: 0.85 }), 0, 0.07, 0, g);
    else for (let k = 0; k < 16; k++) mesh(new THREE.SphereGeometry(0.025, 6, 5), furDark, (Math.random() - 0.5) * 0.2, 0.07, (Math.random() - 0.5) * 0.2, g);
    g.position.set(x, 0, z);
    scene.add(g);
  };
  bowl(3.0, 3.75, 'kibble');
  bowl(3.45, 3.25, 'water');

  let happy = 0, nextTwitch = 2000;
  live((t, dt) => {
    const m = motion();
    happy = Math.max(0, happy - dt);
    body.scale.set(1, 1, 1);
    const breathe = m ? Math.sin(t * 0.0025) * 0.03 : 0;
    body.scale.x = 1 + breathe;        // capsule axis is rotated, so x scales its girth
    body.scale.z = 1 + breathe;
    const wag = m ? Math.sin(t * (happy > 0 ? 0.03 : 0.008)) * (happy > 0 ? 0.7 : 0.25) : 0;
    tail.rotation.y = wag;
    head.rotation.y = m ? Math.sin(t * 0.0004) * 0.35 + (happy > 0 ? 0.25 : 0) : 0;
    head.rotation.z = happy > 0 ? 0.25 : (m ? Math.sin(t * 0.0006) * 0.05 : 0);
    tongue.visible = happy > 0;
    nextTwitch -= dt * 1000;
    if (m && nextTwitch <= 0) { nextTwitch = 2500 + Math.random() * 4000; ears[Math.random() < 0.5 ? 0 : 1].userData.twitch = 1; }
    ears.forEach((e, i) => {
      const tw = e.userData.twitch || 0;
      e.rotation.z = -tw * 0.5;
      e.userData.twitch = Math.max(0, tw - dt * 5);
      e.rotation.x = (i ? 1 : -1) * (0.32 + (happy > 0 ? -0.15 : 0));
    });
  });

  const dogHits = [];
  dog.traverse((o) => { if (o.isMesh) dogHits.push(o); });

  /* ---------- Screens that need redrawing ---------- */

  const redraw = (t) => {
    drawTerm(t);
    gameScreens.forEach(({ c, tex, k }) => { drawGame(c.getContext('2d'), k, t); tex.needsUpdate = true; });
  };

  return {
    update(t, dt) { updaters.forEach((fn) => fn(t, dt)); },
    redraw,
    dogHits,
    doorHits,
    setDoor(open) { doorGoal = open ? 1 : 0; },
    pokeDog() { happy = 2.5; },
  };
}
