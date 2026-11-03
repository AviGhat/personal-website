import * as THREE from 'three';

/* ==========================================================
   The lounge arcade cabinet: an upright with red side panels,
   a lit marquee, a joystick and six buttons. Its screen shows
   Road Fighter (js/fighter.js): the title card when idle, the
   live match while someone plays.
   ========================================================== */

export function buildCabinet({ scene, token, color, box, canvasTexture, small, motion, game }) {
  const V = (x, y) => new THREE.Vector2(x, y);
  const mat = (name, rough = 0.5, metal = 0.3) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, envMapIntensity: 0.35 });
  const glow = (name) => new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });

  // Canvas lettering, repainted once the site fonts have loaded
  const painted = (w, h, paint) => {
    const t = canvasTexture(w, h, paint);
    if (document.fonts) document.fonts.ready.then(() => { paint(t.image.getContext('2d'), w, h); t.needsUpdate = true; });
    return t;
  };

  const cab = new THREE.Group();
  const hits = [];

  // Side profile (z forward, y up): control panel jutting out, screen leaning back, marquee on top
  const profile = [V(-0.42, 0), V(0.36, 0), V(0.36, 0.86), V(0.56, 0.92), V(0.5, 1.02), V(0.26, 1.06), V(0.06, 1.66), V(0.14, 1.68), V(0.22, 1.96), V(-0.42, 1.96)];
  const extrude = (w, m, x) => {
    const shape = new THREE.Shape(profile.map((p) => V(-p.x, p.y)));   // (-z, y), extruded across x
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }), m);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.x = x;
    mesh.castShadow = mesh.receiveShadow = true;
    cab.add(mesh);
    hits.push(mesh);
    return mesh;
  };
  extrude(0.84, mat('--soot', 0.6, 0.3), -0.42);                     // body
  const sideM = mat('--bebop-red', 0.5, 0.2);
  extrude(0.03, sideM, -0.46);                                       // side panels
  extrude(0.03, sideM, 0.43);
  // Side art: an amber stripe and the cabinet's name, on each side
  const art = painted(256, 128, (g, w, h) => {
    g.fillStyle = token('--bebop-red'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--amber'); g.fillRect(0, 70, w, 10); g.fillRect(0, 86, w, 4);
    g.fillStyle = token('--space-black'); g.font = 'bold 30px Syncopate, sans-serif';
    g.fillText('ROAD', 16, 52);
  });
  [-0.476, 0.476].forEach((x) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: art, roughness: 0.6 }));
    p.position.set(x, 1.25, -0.1);
    p.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    cab.add(p);
  });

  // Screen, set into the leaning face
  const sc = document.createElement('canvas');
  sc.width = 320; sc.height = 180;
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.magFilter = THREE.NearestFilter;   // keep the pixels square
  const tilt = Math.atan2(0.2, 0.6);
  const face = new THREE.Group();
  face.position.set(0, 1.36, 0.16);
  face.rotation.x = -tilt;
  cab.add(face);
  box(0.78, 0.58, 0.02, mat('--space-black', 0.4, 0.2), 0, 0, 0.005, face);   // bezel
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.394), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = 0.02;
  face.add(screen);
  hits.push(screen);

  // Marquee: a lit header card
  const marqueeTex = painted(512, 128, (g, w, h) => {
    g.fillStyle = token('--space-black'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--bebop-red'); g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
    g.font = 'bold 54px Syncopate, sans-serif'; g.textAlign = 'center';
    g.fillStyle = token('--bebop-red'); g.fillText('ROAD FIGHTER', w / 2 + 3, 86);
    g.fillStyle = token('--amber'); g.fillText('ROAD FIGHTER', w / 2, 83);
  });
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.25), new THREE.MeshBasicMaterial({ map: marqueeTex, toneMapped: false }));
  marquee.position.set(0, 1.82, 0.185);
  marquee.rotation.x = Math.atan2(0.08, 0.28);
  cab.add(marquee);

  // Control panel: joystick and six buttons
  const panel = new THREE.Group();
  panel.position.set(0, 1.04, 0.38);
  panel.rotation.x = Math.atan2(0.04, 0.24);
  cab.add(panel);
  const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16), mat('--space-black', 0.4, 0.4));
  stickBase.position.set(-0.24, 0.005, 0.02);
  panel.add(stickBase);
  const stick = new THREE.Group();
  stick.position.set(-0.24, 0, 0.02);
  panel.add(stick);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), mat('--fx-steel', 0.3, 0.8));
  shaft.position.y = 0.045;
  stick.add(shaft);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), mat('--bebop-red', 0.35, 0.1));
  ball.position.y = 0.095;
  stick.add(ball);
  const buttons = [];
  ['--amber', '--bebop-red', '--cream', '--amber', '--bebop-red', '--cream'].forEach((c, k) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 14), glow(c));
    b.position.set(-0.05 + (k % 3) * 0.08 + (k < 3 ? 0 : 0.02), 0.008, k < 3 ? -0.02 : 0.06);
    panel.add(b);
    buttons.push({ m: b.material, base: color(c), phase: k * 0.7 });
  });

  // Coin door: two lit slots
  box(0.3, 0.34, 0.02, mat('--hull-dark', 0.5, 0.6), 0, 0.42, 0.37, cab);
  const slotM = glow('--bebop-red');
  [-0.06, 0.06].forEach((x) => box(0.035, 0.07, 0.01, slotM, x, 0.48, 0.385, cab).castShadow = false);
  // Amber edge trim down the front of the panel and under the marquee
  const trim = glow('--amber');
  box(0.86, 0.015, 0.015, trim, 0, 1.68, 0.14, cab).castShadow = false;
  box(0.86, 0.015, 0.015, trim, 0, 0.88, 0.37, cab).castShadow = false;

  // The screen lights the floor in front of it
  let light = null;
  if (!small) {
    light = new THREE.PointLight(color('--amber'), 2, 3.5, 2);
    light.position.set(0, 1.4, 0.9);
    cab.add(light);
  }

  // Back wall, left of the stairs, facing the room
  cab.position.set(-3.7, 0, -5.85);
  cab.scale.setScalar(1.3);   // the lounge is built a little larger than life
  scene.add(cab);

  let hot = false;
  const g = sc.getContext('2d');
  return {
    screen,
    hits,
    setHot(v) { hot = v; },
    update(t) {
      const m = motion();
      buttons.forEach((b) => b.m.color.copy(b.base).multiplyScalar(!m || hot || Math.sin(t * 0.004 + b.phase) > -0.2 ? 1 : 0.35));
      if (m && game.running) stick.rotation.set(Math.sin(t * 0.01) * 0.15, 0, Math.sin(t * 0.013) * 0.2);
      else stick.rotation.set(0, 0, 0);
      if (light) light.intensity = (hot ? 3 : 2) * (m ? 0.9 + 0.1 * Math.sin(t * 0.03) : 1);
    },
    // Copy the game (or its title card) onto the cabinet glass
    redraw(t) {
      game.attract(t);
      g.drawImage(game.canvas, 0, 0);
      screenTex.needsUpdate = true;
    },
  };
}
