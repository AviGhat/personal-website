import * as THREE from 'three';

/* ==========================================================
   The studio: through the door in the lounge's right wall.
   A small, warm room for making music: a desk with the laptop
   (NIGHTSHIFT runs on it), monitor speakers, a MIDI keyboard,
   foam panels, a couch, a guitar on its stand, a record shelf,
   plants, a lamp and an ON AIR light over the door.
   Sits behind the lounge's right wall, x 8..17.6, z -7..3.
   ========================================================== */

export function buildStudio({ scene, token, color, box, rbox, rod, canvasTexture, small, motion }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const updaters = [];
  const mat = (name, rough = 0.8, metal = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, envMapIntensity: 0.3, ...extra });
  const glow = (name) => new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });
  const X0 = 8.02, X1 = 17.6, Z0 = -7, Z1 = 3, H = 4.6;
  const XC = (X0 + X1) / 2, ZC = (Z0 + Z1) / 2, W = X1 - X0, D = Z1 - Z0;

  /* ---------- Room ---------- */

  const plank = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = token('--bark'); g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = token(y % 64 ? '--couch-shade' : '--bark'); g.globalAlpha = 0.55; g.fillRect(0, y, w, 30); g.globalAlpha = 1;
      g.fillStyle = token('--coffee'); g.fillRect(0, y + 30, w, 2);
      g.fillRect((y * 37) % w, y, 2, 30);
    }
  }, [4, 4]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: plank, roughness: 0.7, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(XC, 0.005, ZC);
  floor.receiveShadow = true;
  scene.add(floor);
  const wallM = mat('--wall', 0.85, 0.2);
  const plane = (w, h, x, y, z, ry, m = wallM) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z); p.rotation.y = ry; p.receiveShadow = true; scene.add(p); return p;
  };
  plane(W, H, XC, H / 2, Z0, 0);                       // back
  plane(W, H, XC, H / 2, Z1, Math.PI);                 // front
  plane(D, H, X1, H / 2, ZC, -Math.PI / 2);            // far wall
  // Near wall shares the lounge's: built round the doorway
  plane(-2.65 - Z0, H, X0, H / 2, (Z0 - 2.65) / 2, Math.PI / 2);
  plane(Z1 + 0.75, H, X0, H / 2, (Z1 - 0.75) / 2, Math.PI / 2);
  plane(1.9, H - 3.15, X0, (H + 3.15) / 2, -1.7, Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('--soot', 0.9, 0.1));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(XC, H, ZC);
  scene.add(ceil);
  // A warm LED strip round the top of the walls
  box(W, 0.04, 0.04, glow('--lamp-warm'), XC, H - 0.12, Z0 + 0.04).castShadow = false;
  box(0.04, 0.04, D, glow('--lamp-warm'), X1 - 0.04, H - 0.12, ZC).castShadow = false;

  // Rug
  const rugTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = token('--rug-teal'); g.fillRect(0, 0, w, h);
    g.strokeStyle = token('--amber'); g.lineWidth = 8; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = token('--cream'); g.globalAlpha = 0.5;
    for (let k = 0; k < 5; k++) g.fillRect(40, 50 + k * 34, w - 80, 6);
    g.globalAlpha = 1;
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(13.2, 0.01, -2.2);
  scene.add(rug);

  // Acoustic foam: a checker of panels on the back and far walls
  const foamTex = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = token('--rug-red'); g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
      g.fillStyle = token('--space-black'); g.globalAlpha = 0.25; g.fillRect(x + 8, y, 8, 8); g.fillRect(x, y + 8, 8, 8); g.globalAlpha = 1;
    }
  });
  const foamA = new THREE.MeshStandardMaterial({ map: foamTex, roughness: 1 });
  const foamB = mat('--rug-teal', 1, 0);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) box(0.9, 0.9, 0.08, (i + j) % 2 ? foamA : foamB, 10.2 + i * 1.15, 2.3 + j * 1.0, Z0 + 0.05);
  for (let i = 0; i < 4; i++) box(0.08, 0.9, 0.9, i % 2 ? foamA : foamB, X1 - 0.05, 2.8, -5.5 + i * 1.6);

  /* ---------- The desk and the laptop ---------- */

  const deskM = mat('--bark', 0.6, 0.1);
  const steel = mat('--hull-dark', 0.5, 0.6);
  box(3.4, 0.08, 1.1, deskM, 12.8, 0.8, -6.2);
  [[-1.6, -0.45], [1.6, -0.45], [-1.6, 0.45], [1.6, 0.45]].forEach(([x, z]) => box(0.07, 0.8, 0.07, steel, 12.8 + x, 0.4, -6.2 + z));
  // Laptop: base, keyboard deck and the open screen
  const laptop = new THREE.Group();
  laptop.position.set(12.8, 0.84, -6.05);
  scene.add(laptop);
  box(0.9, 0.035, 0.6, mat('--hull-mid', 0.4, 0.7), 0, 0.017, 0, laptop);
  box(0.78, 0.004, 0.32, mat('--space-black', 0.6, 0.2), 0, 0.037, 0.06, laptop);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.03, -0.29);
  hinge.rotation.x = -0.32;
  laptop.add(hinge);
  box(0.9, 0.58, 0.03, mat('--hull-mid', 0.4, 0.7), 0, 0.29, 0, hinge);
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 480; scrCanvas.height = 300;
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.51), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  screen.position.set(0, 0.29, 0.017);
  hinge.add(screen);
  const laptopPad = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  laptopPad.position.set(0, 0.35, -0.05);
  laptop.add(laptopPad);
  // MIDI keyboard in front, monitor speakers either side
  const keysTex = canvasTexture(256, 32, (g, w, h) => {
    g.fillStyle = token('--cream'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--space-black');
    for (let k = 0; k < 25; k++) g.fillRect(k * (w / 25), 0, 1, h);
    for (let k = 0; k < 25; k++) if ([1, 3, 6, 8, 10].includes(k % 12)) g.fillRect(k * (w / 25) + 3, 0, 6, h * 0.6);
  });
  box(1.3, 0.06, 0.3, mat('--soot', 0.5, 0.3), 12.8, 0.87, -5.6);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.16), new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.6 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(12.8, 0.905, -5.56);
  scene.add(keys);
  [11.3, 14.3].forEach((x) => {
    const sp = new THREE.Group();
    rbox(0.42, 0.62, 0.4, 0.03, mat('--soot', 0.6, 0.2), 0, 0.31, 0, sp);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), mat('--hull-mid', 0.5, 0.4));
    cone.position.set(0, 0.22, 0.205); sp.add(cone);
    const tw = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), mat('--amber', 0.4, 0.6));
    tw.position.set(0, 0.47, 0.205); sp.add(tw);
    sp.position.set(x, 0.84, -6.3);
    sp.rotation.y = x < 12.8 ? 0.25 : -0.25;
    scene.add(sp);
  });
  // Headphones and a mug on the desk
  const cans = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 20, Math.PI), mat('--bebop-red', 0.5, 0.3));
  cans.rotation.set(Math.PI / 2, 0, 0.5);
  cans.position.set(14.0, 0.86, -5.8);
  scene.add(cans);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.13, 12), mat('--cream', 0.6, 0.1));
  mug.position.set(11.8, 0.9, -5.8);
  scene.add(mug);
  // Chair
  const chair = new THREE.Group();
  rbox(0.6, 0.1, 0.6, 0.04, mat('--soot', 0.6, 0.2), 0, 0.5, 0, chair);
  rbox(0.6, 0.8, 0.1, 0.04, mat('--bebop-red', 0.7, 0.1), 0, 0.95, 0.28, chair);
  rod(V(0, 0.05, 0), V(0, 0.45, 0), 0.03, steel, chair);
  chair.position.set(12.8, 0, -4.9);
  chair.rotation.y = 0.2;
  scene.add(chair);

  /* ---------- Cozy: couch, guitar, records, plants, lamp, ON AIR ---------- */

  const couch = new THREE.Group();
  box(1.2, 0.4, 3.0, mat('--couch-shade', 0.9, 0), 0, 0.2, 0, couch);
  for (let k = 0; k < 2; k++) rbox(0.9, 0.22, 1.4, 0.07, mat('--couch', 0.9, 0), -0.1, 0.5, -0.72 + k * 1.44, couch);
  rbox(0.3, 0.8, 3.0, 0.08, mat('--couch', 0.9, 0), 0.45, 0.75, 0, couch);
  couch.position.set(16.7, 0, -1.2);
  scene.add(couch);
  rbox(0.18, 0.42, 0.5, 0.08, mat('--amber', 0.95, 0), 16.4, 0.78, -2.0).rotation.set(0, 0.3, -0.2);
  // Guitar on a stand
  const guitar = new THREE.Group();
  [[0, 0.32, 0.22], [0, 0.62, 0.17]].forEach(([x, y, r]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.09, 24), mat('--amber', 0.4, 0.2)); b.rotation.x = Math.PI / 2; b.position.set(x, y, 0); guitar.add(b); });
  box(0.06, 0.7, 0.04, mat('--bark', 0.5, 0.1), 0, 1.1, 0, guitar);
  box(0.12, 0.16, 0.04, mat('--space-black', 0.5, 0.2), 0, 1.5, 0, guitar);
  rod(V(-0.15, 0, 0.1), V(0, 0.4, 0), 0.015, steel, guitar);
  rod(V(0.15, 0, 0.1), V(0, 0.4, 0), 0.015, steel, guitar);
  guitar.position.set(16.6, 0.02, -5.8);
  guitar.rotation.set(-0.15, -0.6, 0);
  scene.add(guitar);
  // Record shelf with sleeves in the site's colours
  box(2.2, 0.06, 0.4, deskM, 9.6, 1.6, Z0 + 0.25);
  box(2.2, 0.06, 0.4, deskM, 9.6, 1.0, Z0 + 0.25);
  ['--bebop-red', '--amber', '--teal', '--cream', '--rug-teal', '--bebop-red', '--amber', '--soot', '--cream', '--teal'].forEach((c, k) => {
    box(0.03, 0.4, 0.36, mat(c, 0.7, 0), 8.7 + k * 0.18, 1.83, Z0 + 0.26).rotation.z = (k % 3) * 0.04;
  });
  box(0.4, 0.12, 0.36, mat('--hull-dark', 0.4, 0.5), 9.3, 1.09, Z0 + 0.26);   // a little turntable
  // Plants
  const pot = mat('--rail', 0.8, 0.1), leaf = mat('--leaf', 0.75, 0), leaf2 = mat('--leaf-light', 0.75, 0);
  [[9.0, 2.2], [17.0, 2.4], [15.3, -6.5]].forEach(([x, z], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 14), pot); p.position.set(x, 0.225, z); scene.add(p);
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9, len = 0.7 + (k % 3) * 0.25;
      const b = box(0.14, len, 0.03, k % 2 ? leaf : leaf2, x + Math.cos(a) * 0.08, 0.45 + len / 2, z + Math.sin(a) * 0.08);
      b.rotation.set(Math.sin(a) * 0.2, a, Math.cos(a) * 0.2);
    }
  });
  // Floor lamp by the couch
  rod(V(16.9, 0, 1.8), V(16.9, 1.7, 1.8), 0.025, steel);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 0.36, 20, 1, true), mat('--lamp-shade', 0.9, 0, { side: THREE.DoubleSide, emissive: color('--lamp-warm'), emissiveIntensity: 0.8 }));
  shade.position.set(16.9, 1.8, 1.8);
  scene.add(shade);
  // ON AIR light over the door, lit while the app is playing
  const onAirTex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = token('--space-black'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--bebop-red'); g.font = 'bold 40px Syncopate, sans-serif'; g.textAlign = 'center'; g.fillText('ON AIR', w / 2, 46);
  });
  const onAirM = new THREE.MeshBasicMaterial({ map: onAirTex, toneMapped: false });
  const onAir = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), onAirM);
  onAir.position.set(X0 + 0.03, 3.5, -1.7);
  onAir.rotation.y = Math.PI / 2;
  scene.add(onAir);

  // Light: warm and low, plus the screen's glow
  if (!small) {
    const lamp = new THREE.PointLight(color('--lamp-warm'), 10, 9, 1.6); lamp.position.set(16.6, 2.2, 1.6); scene.add(lamp);
    const desk = new THREE.PointLight(color('--lamp-warm'), 8, 8, 1.6); desk.position.set(12.8, 3.4, -4.5); scene.add(desk);
  }
  const screenGlow = new THREE.PointLight(color('--neon-cyan'), small ? 0 : 2.5, 4, 2);
  screenGlow.position.set(12.8, 1.3, -5.6);
  scene.add(screenGlow);

  /* ---------- The laptop screen: the app's pattern in miniature ---------- */

  let hot = false, live = false;
  const drawScreen = (t, snap) => {
    const g = scrCanvas.getContext('2d');
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, 480, 300);
    g.fillStyle = token('--amber'); g.font = '24px VT323, monospace'; g.fillText('NIGHTSHIFT', 16, 28);
    g.fillStyle = token('--ink-dim'); g.font = '18px VT323, monospace';
    if (snap) {
      const { st, step } = snap;
      g.fillText(`${st.bpm} BPM  ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][st.key]} ${st.scale.toUpperCase()}`, 170, 28);
      const cols = st.steps, cw = 448 / cols;
      st.channels.forEach((c, r) => {
        for (let i = 0; i < cols; i++) {
          const on = c.type === 'drum' ? c.steps[i] : c.notes.some((n) => i >= n.step && i < n.step + n.len);
          g.fillStyle = token(i === step ? '--neon' : on ? (c.type === 'drum' ? '--amber' : '--neon-cyan') : '--rule');
          g.fillRect(16 + i * cw + 1, 48 + r * 23, cw - 2, 18);
        }
      });
    }
    if (hot || Math.floor(t / 600) % 2) { g.fillStyle = token('--neon'); g.fillText('> OPEN THE SESSION', 16, 292); }
    scrTex.needsUpdate = true;
  };
  updaters.push((t) => {
    onAirM.color.setScalar(live ? (motion() ? 0.85 + 0.15 * Math.sin(t * 0.008) : 1) : 0.25);
    screenGlow.intensity = small ? 0 : (hot ? 3.5 : 2.5);
  });

  return {
    laptopScreen: screen,
    hits: { laptop: [laptopPad] },
    // Standing just inside the door, looking across to the desk
    pose(portrait) {
      return portrait ? { pos: V(9.6, 3.4, 2.4), target: V(13.2, 0.9, -5.2) } : { pos: V(9.8, 2.7, 1.8), target: V(13.4, 1.2, -5.0) };
    },
    update(t, dt) { updaters.forEach((fn) => fn(t, dt)); },
    redraw(t, snap) { drawScreen(t, snap); },
    setHot(v) { hot = v; },
    setLive(v) { live = v; },
  };
}
