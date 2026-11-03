import * as THREE from 'three';

/* ==========================================================
   Hyperspace and the cockpit.
   The ship flies toward -z. One field of streaks rushes past it:
   through the lounge's side viewport they slide by sideways,
   through the cockpit glass they burst out of a point ahead.
   ========================================================== */

const CX = 2.3;          // cockpit centre line (matches the stairs and the door)
const FY = 3.03;         // cockpit deck height (top of the landing)
const AXIS_Y = FY + 1.6; // vanishing point height

export const THRUST_DEFAULT = 0.3;   // gives the cruise speed the scene was tuned at

export function buildHyperspace({ scene, color, motion, small }) {
  const N = small ? 900 : 1600;
  const FAR = -340;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
  const streaks = new THREE.InstancedMesh(geo, material, N);
  streaks.frustumCulled = false;
  const palette = [['--amber', 0.45], ['--cream', 0.3], ['--neon', 0.15], ['--neon-cyan', 0.1]];
  const pick = () => { let r = Math.random(); for (const [n, w] of palette) { if ((r -= w) <= 0) return color(n); } return color('--cream'); };

  const lines = [];
  const place = (l, anywhere) => {
    // Dense near the axis so the cockpit sees a tunnel; a band along the left flank
    // fills the lounge viewport
    let r;
    if (Math.random() < 0.35) {
      l.x = -12 - Math.pow(Math.random(), 1.3) * 60;
      l.y = -6 + Math.random() * 26;
      r = Math.hypot(l.x - CX, l.y - AXIS_Y);
    } else {
      r = 2 + Math.pow(Math.random(), 1.6) * 150;
      const a = Math.random() * Math.PI * 2;
      l.x = CX + Math.cos(a) * r;
      l.y = AXIS_Y + Math.sin(a) * r * 0.75;
    }
    // Streaks whose path crosses the ship stop short of it
    const crossesShip = l.x > -10 && l.x < 10 && l.y > -2 && l.y < 10;
    l.end = crossesShip ? -24 : 90;
    l.z = anywhere ? FAR + Math.random() * (l.end - FAR) : FAR + Math.random() * 30;
    l.len = 5 + Math.random() * 22;
    l.w = 0.05 + r * 0.0035 + Math.random() * 0.05;
  };
  const colorAttr = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const l = {};
    place(l, true);
    lines.push(l);
    colorAttr.copy(pick()).multiplyScalar(0.55 + Math.random() * 0.6);
    streaks.setColorAt(i, colorAttr);
  }
  scene.add(streaks);

  // A white-hot point far ahead, where everything comes from
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--glare').trim());
    rg.addColorStop(0.25, getComputedStyle(document.documentElement).getPropertyValue('--amber').trim());
    rg.addColorStop(1, 'transparent');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  core.position.set(CX, AXIS_Y, FAR + 10);
  core.scale.set(60, 60, 1);
  scene.add(core);

  /* ---------- Earth below: we're flying over it ---------- */

  // Equirectangular texture from wrapping value noise: oceans, land, ice, clouds
  const noise = (seed, periods) => {
    let s = seed;
    const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const oct = periods.map(([px, py]) => { const g = new Float32Array(px * (py + 1)); for (let i = 0; i < g.length; i++) g[i] = rand(); return { px, py, g }; });
    return (u, v) => {
      let sum = 0, amp = 0.5, norm = 0;
      for (const { px, py, g } of oct) {
        const x = u * px, y = v * py, xi = Math.floor(x), yi = Math.min(Math.floor(y), py - 1);
        const fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
        const a = g[yi * px + x0], b = g[yi * px + x1], c = g[(yi + 1) * px + x0], d = g[(yi + 1) * px + x1];
        sum += (a + (b - a) * sx + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy) * amp; norm += amp; amp *= 0.5;
      }
      return sum / norm;
    };
  };
  const land = noise(7, [[8, 4], [16, 8], [32, 16], [64, 32], [128, 64]]);
  const vapour = noise(23, [[24, 6], [48, 14], [96, 28], [192, 56]]);
  const E = ['--earth-deep', '--earth-ocean', '--earth-shallow', '--earth-land', '--earth-sand', '--earth-cloud'].map((n) => color(n));
  const mixC = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
  const paint = (w, h, fn) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) fn(img.data, (j * w + i) * 4, i / w, j / h);
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  };
  const tw = small ? 512 : 1024;
  const groundTex = paint(tw, tw / 2, (d, k, u, v) => {
    const hh = land(u, v);
    let c = hh > 0.56 ? mixC(E[3], E[4], (hh - 0.6) / 0.15) : mixC(mixC(E[0], E[1], (hh - 0.3) / 0.2), E[2], (hh - 0.5) / 0.06);
    c = mixC(c, E[5], Math.max(0, (Math.abs(v * 2 - 1) - 0.86) / 0.1) * 0.9);
    d[k] = c.r * 255; d[k + 1] = c.g * 255; d[k + 2] = c.b * 255; d[k + 3] = 255;
  });
  const cloudTex = paint(tw, tw / 2, (d, k, u, v) => {
    const a = Math.min(1, Math.max(0, (vapour(u, v) - 0.52) / 0.14));
    d[k] = d[k + 1] = d[k + 2] = 245; d[k + 3] = a * 190;
  });
  const R = 200;
  const planet = new THREE.Group();
  // A whole planet at a distance, off to the left and below: its upper limb rises just
  // above the console, like looking down on Earth from high orbit
  planet.position.set(CX - 120, -175, -760);
  planet.rotation.z = 0.35;   // axial tilt
  scene.add(planet);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.8, metalness: 0, fog: false, envMapIntensity: 0.15 }));
  planet.add(earth);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 96, 64), new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, roughness: 1, envMapIntensity: 0.1 }));
  planet.add(clouds);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 64, 48), new THREE.MeshBasicMaterial({ color: color('--atmo'), transparent: true, opacity: 0.22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  planet.add(atmo);

  // Speed follows the cockpit throttle: 0 idles, 1 is full burn. Streaks stretch as we speed up
  let thrust = THRUST_DEFAULT, speed = 1;
  const speedFor = (k) => 0.25 + k * 2.5;

  const m = streaks.instanceMatrix.array;
  const write = () => {
    const stretch = 0.45 + 0.55 * speed;
    for (let i = 0; i < N; i++) {
      const l = lines[i], o = i * 16;
      m[o] = l.w; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = l.w; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = l.len * stretch; m[o + 11] = 0;
      m[o + 12] = l.x; m[o + 13] = l.y; m[o + 14] = l.z - l.len * stretch / 2; m[o + 15] = 1;
    }
    streaks.instanceMatrix.needsUpdate = true;
  };
  write();

  return {
    setThrust(k) { thrust = k; },
    update(t, dt) {
      if (!motion()) return;
      speed += (speedFor(thrust) - speed) * Math.min(1, dt * 1.8);   // the drive spools up and down, not instantly
      const v = 150 * dt * speed;
      for (const l of lines) {
        l.z += v * (0.8 + l.w * 2);
        if (l.z > l.end) place(l, false);
      }
      write();
      const s = 55 + Math.sin(t * 0.004) * 8;
      core.scale.set(s, s, 1);
      // The surface rolls toward us as we fly over it; clouds drift a little faster
      // The planet turns; clouds drift a little faster than the ground
      earth.rotation.y += dt * 0.012;
      clouds.rotation.y += dt * 0.016;
    },
  };
}

export function buildCockpit({ scene, token, color, box, rbox, rod, canvasTexture, small, motion }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const slopes = [];   // tilted console tops that carry buttons
  const mat = (name, rough = 0.6, metal = 0.4, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, envMapIntensity: 0.4, ...extra });
  const glow = (name) => new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });

  const wallM = mat('--cockpit-wall', 0.55, 0.45);
  const trimM = mat('--cockpit-trim', 0.45, 0.6);
  const darkM = mat('--hull-dark', 0.5, 0.6);
  const padM = mat('--seat-pad', 0.85, 0.05);
  const blue = glow('--floor-light');
  const z0 = -6.62, z1 = -16.8, x0 = -0.9, x1 = 5.5, H = 3.5;
  const zc = (z0 + z1) / 2, len = z0 - z1, wid = x1 - x0;

  // Panelled wall texture: light plates with seams, like the reference bridge
  const panelTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = token('--cockpit-wall'); g.fillRect(0, 0, w, h);
    g.strokeStyle = token('--cockpit-trim'); g.lineWidth = 3;
    g.strokeRect(8, 8, w - 16, h / 2 - 12); g.strokeRect(8, h / 2 + 4, w - 16, h / 2 - 12);
    g.strokeRect(40, 40, 70, 40);
    g.fillStyle = token('--cockpit-trim');
    for (let x = 20; x < w; x += 24) g.fillRect(x, h - 30, 12, 4);
  }, [len / 3, 1]);
  const panelM = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.55, metalness: 0.4, envMapIntensity: 0.4 });

  const plane = (w, h, m, x, y, z, rx = 0, ry = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z); p.rotation.set(rx, ry, 0, 'YXZ'); p.receiveShadow = true; scene.add(p); return p;
  };

  /* ---------- Shell ---------- */

  box(wid, 0.2, len, trimM, CX, FY - 0.1, zc);                              // deck
  plane(wid, len, mat('--cockpit-wall', 0.7, 0.3), CX, FY + H, zc, Math.PI / 2);   // ceiling, facing down
  plane(len, H, panelM, x0, FY + H / 2, zc, 0, Math.PI / 2);               // left wall
  plane(len, H, panelM, x1, FY + H / 2, zc, 0, -Math.PI / 2);              // right wall
  // Angled panels where walls meet the ceiling
  [[x0 + 0.42, -1], [x1 - 0.42, 1]].forEach(([x, s]) => {
    const p = plane(len, 1.2, wallM, x, FY + H - 0.42, zc, 0, s * -Math.PI / 2);
    p.rotation.set(0, s * -Math.PI / 2, s * Math.PI / 4, 'YXZ');
  });
  // Rear wall around the door (seen from inside the cockpit)
  plane(1.3 - x0, H, wallM, (x0 + 1.3) / 2, FY + H / 2, z0, 0, Math.PI);
  plane(x1 - 3.3, H, wallM, (3.3 + x1) / 2, FY + H / 2, z0, 0, Math.PI);
  plane(2.0, H - 2.62, wallM, CX, FY + 2.62 + (H - 2.62) / 2, z0, 0, Math.PI);

  /* ---------- Back wall: posters and music gear, seen when you turn round ---------- */

  const BZ = z0 - 0.02;   // just proud of the rear wall, facing into the cockpit
  const poster = (w, h, x, y, paint) => {
    const tex = canvasTexture(256, Math.round(256 * h / w), paint);
    const p = plane(w, h, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, envMapIntensity: 0.1 }), x, y, BZ, 0, Math.PI);
    box(w + 0.06, h + 0.06, 0.02, darkM, x, y, BZ + 0.012);
    return p;
  };
  const ink = (g, name) => { g.fillStyle = token(name); };
  // 1. A wanted poster, the bounty-board kind
  poster(0.95, 1.3, -0.25, FY + 2.15, (g, w, h) => {
    ink(g, '--cream'); g.fillRect(0, 0, w, h);
    ink(g, '--paper-ink'); g.font = 'bold 40px Syncopate, sans-serif'; g.fillText('WANTED', 14, 52);
    g.fillRect(14, 64, w - 28, 3);
    ink(g, '--paper-red'); g.fillRect(40, 80, w - 80, 150);
    ink(g, '--paper-ink');   // a hat-and-coat silhouette, nobody in particular
    g.beginPath(); g.ellipse(w / 2, 130, 52, 9, 0, 0, 6.283); g.fill();
    g.fillRect(w / 2 - 28, 98, 56, 32);
    g.beginPath(); g.arc(w / 2, 150, 20, 0, 6.283); g.fill();
    g.beginPath(); g.moveTo(w / 2 - 50, 230); g.quadraticCurveTo(w / 2, 160, w / 2 + 50, 230); g.fill();
    g.font = 'bold 26px "Share Tech Mono", monospace'; g.fillText('₩ 3,300,000', 30, 270);
    g.font = '16px "Share Tech Mono", monospace'; g.fillText('THE SAX BANDIT', 30, 296); g.fillText('DEAD OR ALIVE', 30, 318);
  });
  // 2. A gig bill: a saxophone in silhouette on red
  poster(0.95, 1.3, 0.8, FY + 2.15, (g, w, h) => {
    ink(g, '--bebop-red'); g.fillRect(0, 0, w, h);
    ink(g, '--amber'); g.beginPath(); g.arc(w / 2, 120, 84, 0, 6.283); g.fill();
    ink(g, '--paper-ink');
    g.lineWidth = 14; g.lineCap = 'round'; g.strokeStyle = token('--paper-ink');
    g.beginPath(); g.moveTo(150, 40); g.lineTo(150, 170); g.quadraticCurveTo(150, 200, 120, 200); g.lineTo(100, 200); g.quadraticCurveTo(80, 200, 82, 170); g.stroke();
    g.beginPath(); g.ellipse(84, 160, 20, 12, -0.3, 0, 6.283); g.fill();
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(160, 70 + k * 20, 5, 0, 6.283); g.fill(); }
    ink(g, '--cream'); g.font = 'bold 30px Syncopate, sans-serif'; g.fillText('BOP', 20, 270); g.fillText('SWING', 20, 306);
    g.font = '15px "Share Tech Mono", monospace'; g.fillText('LIVE / MARS DOCK 7 / FRI', 20, 336);
  });
  // 3. A session title card
  poster(0.9, 1.25, 4.05, FY + 2.15, (g, w, h) => {
    ink(g, '--space-black'); g.fillRect(0, 0, w, h);
    ink(g, '--cream'); g.font = 'bold 22px Syncopate, sans-serif'; g.fillText('SESSION', 18, 60);
    g.font = 'bold 72px Syncopate, sans-serif'; g.fillText('27', 18, 140);
    ink(g, '--amber'); g.fillRect(18, 156, w - 36, 4);
    ink(g, '--cream'); g.font = '20px "Share Tech Mono", monospace'; g.fillText('LOW ORBIT', 18, 200); g.fillText('BLUES', 18, 226);
    ink(g, '--bebop-red'); g.beginPath(); g.arc(w - 56, h - 60, 30, 0, 6.283); g.fill();
  });

  // Neon over the door
  const neon = canvasTexture(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'italic bold 64px Syncopate, sans-serif';
    g.lineWidth = 6; g.strokeStyle = token('--bebop-red'); g.strokeText('JAZZ', 30, 86);
    g.fillStyle = token('--amber'); g.font = 'bold 34px "Share Tech Mono", monospace'; g.fillText('& BLUES', 300, 84);
  });
  const neonSign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false }));
  neonSign.position.set(CX, FY + 3.08, BZ - 0.01);
  neonSign.rotation.y = Math.PI;
  scene.add(neonSign);

  // Guitar on the wall: body in two bouts, neck, headstock, pickguard
  const guitar = new THREE.Group();
  const gRed = mat('--bebop-red', 0.35, 0.3);
  [[0, 0, 0.24], [0, 0.27, 0.18]].forEach(([x, y, r]) => {
    const bout = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 28), gRed);
    bout.rotation.x = Math.PI / 2; bout.position.set(x, y, 0); guitar.add(bout);
  });
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.075, 20), mat('--cream', 0.5, 0.1));
  guard.rotation.x = Math.PI / 2; guard.position.set(0.06, 0.02, 0.002); guitar.add(guard);
  box(0.06, 0.62, 0.035, mat('--couch-shade', 0.6, 0.1), 0, 0.68, 0.01, guitar);
  box(0.11, 0.17, 0.035, darkM, 0, 1.06, 0.01, guitar);
  guitar.position.set(5.0, FY + 1.4, BZ - 0.06);
  guitar.rotation.set(0, Math.PI, -0.18);
  scene.add(guitar);

  // Two records in frames
  [[3.75, '--amber'], [4.3, '--neon-cyan']].forEach(([x, label]) => {
    box(0.48, 0.48, 0.03, darkM, x, FY + 0.95, BZ - 0.01);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 32), mat('--space-black', 0.25, 0.4));
    disc.rotation.x = Math.PI / 2; disc.position.set(x, FY + 0.95, BZ - 0.035); scene.add(disc);
    const lab = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), glow(label));
    lab.position.set(x, FY + 0.95, BZ - 0.042); lab.rotation.y = Math.PI; scene.add(lab);
  });

  // Turntable on a shelf, record spinning at 33 1/3
  box(1.3, 0.05, 0.38, trimM, 0.45, FY + 0.95, BZ - 0.19);
  box(0.5, 0.09, 0.36, darkM, 0.12, FY + 1.02, BZ - 0.2);
  const platter = new THREE.Group();
  platter.position.set(0.08, FY + 1.075, BZ - 0.2);
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 32), mat('--space-black', 0.25, 0.4));
  platter.add(lp);
  const lpLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 16), glow('--bebop-red'));
  platter.add(lpLabel);
  box(0.03, 0.015, 0.012, glow('--cream'), 0.035, 0.008, 0, platter);   // a mark so the spin shows
  scene.add(platter);
  rod(V(0.29, FY + 1.09, BZ - 0.08), V(0.15, FY + 1.09, BZ - 0.2), 0.008, trimM);   // tonearm
  // A row of cassettes and a little speaker on the shelf
  for (let k = 0; k < 5; k++) box(0.04, 0.11, 0.07, glow(['--amber', '--cream', '--bebop-red', '--neon', '--floor-light'][k]), 0.55 + k * 0.05, FY + 1.03, BZ - 0.12);
  // Floor speakers in the back corners
  [x0 + 0.35, x1 - 0.35].forEach((x) => {
    box(0.5, 0.95, 0.4, darkM, x, FY + 0.475, BZ - 0.25);
    [0.68, 0.3].forEach((y, k) => {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(k ? 0.15 : 0.08, k ? 0.15 : 0.08, 0.02, 24), trimM);
      cone.rotation.x = Math.PI / 2; cone.position.set(x, FY + y, BZ - 0.46); scene.add(cone);
    });
  });
  // The nose: the whole front opens into a faceted glass canopy that tapers
  // to a point ahead of the ship, glass on top and both sides, hull beneath
  const BL = V(x0, FY, z1), BR = V(x1, FY, z1), TL = V(x0, FY + H, z1), TR = V(x1, FY + H, z1);
  const TIP = V(CX, FY - 0.7, z1 - 4.7);   // below deck: the belly falls away so you can see down to Earth
  const facet = (pts, m) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g.computeVertexNormals();
    const f = new THREE.Mesh(g, m);
    f.receiveShadow = true;
    scene.add(f);
    return f;
  };
  const glassM = new THREE.MeshBasicMaterial({ color: color('--atmo'), transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
  const hullM = mat('--cockpit-trim', 0.5, 0.6, { side: THREE.DoubleSide });
  // Each side is split into two panes at its midpoint so the canopy reads as faceted
  const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
  const LM = mid(TL, BL), RM = mid(TR, BR), TM = mid(TL, TR);
  facet([TL, TM, TIP, TM, TR, TIP], glassM);                    // top
  facet([TL, TIP, LM, LM, TIP, BL], glassM);                    // left
  facet([TR, RM, TIP, RM, BR, TIP], glassM);                    // right
  facet([BL, TIP, BR], hullM);                                  // belly
  // Struts along every edge of the canopy
  [[TL, TIP], [TR, TIP], [BL, TIP], [BR, TIP], [TM, TIP], [LM, TIP], [RM, TIP], [TL, TR], [TL, BL], [TR, BR]]
    .forEach(([a, b], i) => rod(a, b, i < 4 || i > 6 ? 0.07 : 0.035, i < 4 || i > 6 ? trimM : darkM));
  // A lit rim where the canopy meets the cabin
  rod(BL, BR, 0.05, glow('--neon-cyan'));

  // Ceiling light panel and rails
  box(1.6, 0.04, 4.0, glow('--fan-light'), CX, FY + H - 0.03, -10.2).castShadow = false;
  [CX - 1.3, CX + 1.3].forEach((x) => rod(V(x, FY + H - 0.2, z0), V(x, FY + H - 0.2, z1), 0.04, trimM));

  // Floor light strips down the aisle
  for (let z = -7.3; z > -12.9; z -= 0.7) {
    [CX - 0.55, CX + 0.55].forEach((x) => box(0.38, 0.012, 0.13, blue, x, FY + 0.006, z).castShadow = false);
  }
  box(0.06, 0.012, 5.8, blue, CX, FY + 0.006, -10.1).castShadow = false;

  // Crew seats in rows along both walls, like a shuttle bay
  const crewSeat = (x, z, face) => {
    const g = new THREE.Group();
    rbox(0.55, 0.12, 0.55, 0.04, padM, 0, 0.45, 0, g);
    rbox(0.1, 0.75, 0.5, 0.04, padM, -0.27, 0.85, 0, g);
    box(0.4, 0.4, 0.4, trimM, 0, 0.2, 0, g);
    g.position.set(x, FY, z);
    g.rotation.y = face;
    scene.add(g);
  };
  [-7.6, -8.4, -9.2, -10.0].forEach((z) => { crewSeat(x0 + 0.45, z, 0); crewSeat(x1 - 0.45, z, Math.PI); });

  // Portholes: rings with a little screen of passing streaks
  const portCanvas = document.createElement('canvas');
  portCanvas.width = portCanvas.height = 128;
  const portTex = new THREE.CanvasTexture(portCanvas);
  portTex.colorSpace = THREE.SRGBColorSpace;
  const portStreaks = Array.from({ length: 26 }, () => ({ y: Math.random() * 128, x: Math.random() * 128, l: 10 + Math.random() * 40, c: Math.random() < 0.7 ? '--amber' : '--cream' }));
  [[x0 + 0.02, Math.PI / 2], [x1 - 0.02, -Math.PI / 2]].forEach(([x, ry]) => {
    [-8.8, -11.6].forEach((z) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 28), trimM);
      ring.position.set(x, FY + 1.9, z); ring.rotation.y = ry; scene.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 28), new THREE.MeshBasicMaterial({ map: portTex, toneMapped: false }));
      disc.position.set(x + (ry > 0 ? 0.01 : -0.01), FY + 1.9, z); disc.rotation.y = ry; scene.add(disc);
    });
  });

  /* ---------- Pilot seats ---------- */

  const pilotSeat = (x) => {
    const g = new THREE.Group();
    box(0.25, 0.4, 0.25, trimM, 0, 0.2, 0, g);
    rbox(0.72, 0.16, 0.7, 0.06, padM, 0, 0.5, 0, g);
    rbox(0.72, 1.1, 0.16, 0.06, padM, 0, 1.1, 0.33, g).rotation.x = 0.12;
    rbox(0.4, 0.3, 0.12, 0.05, padM, 0, 1.78, 0.42, g).rotation.x = 0.12;
    [-0.42, 0.42].forEach((dx) => {
      rbox(0.12, 1.0, 0.24, 0.04, trimM, dx, 1.05, 0.36, g).rotation.x = 0.12;
      box(0.1, 0.06, 0.55, trimM, dx, 0.75, 0.05, g);
    });
    g.position.set(x, FY, -13.4);
    scene.add(g);
    return g;
  };
  const ownSeat = pilotSeat(1.4);   // the one you sit in
  pilotSeat(3.2);

  /* ---------- Console: radar, pilot file monitor, status, buttons ---------- */

  // A console body whose top follows its tilted panel, so the panel (and all
  // it carries) sits on the body rather than sinking into it. The panel is
  // centred at height `top`, depth `zc`, tipped toward the pilot by `tilt`.
  const consoleBody = (w, d, top, zc, tilt, parent) => {
    const yAt = (z) => top - (z - zc) * Math.tan(tilt) - 0.035;
    const shape = new THREE.Shape();   // profile in (-z, y), extruded across x
    shape.moveTo(-d / 2, 0);
    shape.lineTo(-d / 2, yAt(d / 2));
    shape.lineTo(d / 2, yAt(-d / 2));
    shape.lineTo(d / 2, 0);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }), trimM);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.x = -w / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const dash = new THREE.Group();
  consoleBody(4.6, 1.0, 0.73, 0.15, 0.45, dash);
  const slope = new THREE.Group();
  slope.position.set(0, 0.73, 0.15);
  slope.rotation.x = 0.45;    // face the pilot
  dash.add(slope);
  box(4.6, 0.06, 0.9, darkM, 0, 0, 0, slope);
  dash.position.set(CX, FY, -15.4);
  scene.add(dash);
  // Side consoles angled toward the seats
  [[-0.05, 0.55], [4.65, -0.55]].forEach(([x, ry]) => {
    const g = new THREE.Group();
    consoleBody(1.0, 0.8, 0.97, 0, 0.35, g);
    const top = new THREE.Group(); top.position.y = 0.97; top.rotation.x = 0.35; g.add(top);
    box(1.0, 0.05, 0.75, darkM, 0, 0, 0, top);
    g.userData.top = top;
    g.position.set(x, FY, -14.3);
    g.rotation.y = ry;
    scene.add(g);
    slopes.push(top);
  });

  const screen = (w, h, cw, ch, parent, x, y, z, rx = 0) => {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const bezel = box(w + 0.08, h + 0.08, 0.05, darkM, x, y, z, parent);
    bezel.rotation.x = rx;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    // Lift the glass off its bezel along the face normal
    if (rx) s.position.set(x, y + 0.03, z); else s.position.set(x, y, z + 0.03);
    s.rotation.x = rx;
    parent.add(s);
    return { c, tex, mesh: s };
  };
  // Radar and status lie in the sloped panel; the pilot file monitor stands up in the middle
  const radar = screen(0.62, 0.62, 256, 256, slope, -0.95, 0.035, 0, -Math.PI / 2);
  const status = screen(0.7, 0.42, 256, 160, slope, -0.12, 0.035, 0, -Math.PI / 2);   // centre, where the pilot reads it
  const aboutStand = new THREE.Group();
  // Stands on the console's back ledge, behind everything on the sloped panel, so it
  // never hides a control and never dips into the dash
  aboutStand.position.set(CX + 0.32, FY + 0.9, -15.8);
  aboutStand.rotation.set(-0.05, -0.43, 0, 'YXZ');   // turned toward the pilot
  scene.add(aboutStand);
  box(0.3, 0.02, 0.14, darkM, 0, 0.01, 0, aboutStand);   // foot
  box(0.08, 0.16, 0.06, darkM, 0, 0.09, -0.02, aboutStand);   // neck
  const about = screen(0.8, 0.5, 320, 200, aboutStand, 0, 0.45, 0);

  /* ---------- Throttle: a lever in a slotted quadrant, front and centre ---------- */

  const throttle = new THREE.Group();
  throttle.position.set(0.5, 0.03, 0.08);   // under the pilot's right hand
  slope.add(throttle);
  box(0.2, 0.05, 0.42, darkM, 0, 0.025, 0, throttle);                          // housing
  box(0.03, 0.004, 0.34, mat('--space-black', 0.4, 0.4), 0, 0.052, 0, throttle);   // slot
  const tickM = glow('--amber');
  for (let k = 0; k < 5; k++) box(0.035, 0.005, 0.008, tickM, 0.065, 0.053, -0.15 + k * 0.075, throttle).castShadow = false;
  const lever = new THREE.Group();
  lever.position.y = 0.05;
  throttle.add(lever);
  box(0.022, 0.24, 0.022, mat('--fx-steel', 0.3, 0.85), 0, 0.12, 0, lever);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.15, 14), mat('--bebop-red', 0.4, 0.1));
  grip.rotation.z = Math.PI / 2;
  grip.position.y = 0.245;
  lever.add(grip);
  const throttlePad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  throttlePad.position.y = 0.16;
  throttle.add(throttlePad);
  let thrust = THRUST_DEFAULT, thrustShown = THRUST_DEFAULT;
  // Lever angle: pushed up and away idles, pulled down toward you is full burn
  const leverAngle = (k) => -0.65 + 1.3 * k;
  lever.rotation.x = leverAngle(thrust);

  /* ---------- Cassette deck (plays the playlist) and loose headphones ---------- */

  const shellM = mat('--crt-shell', 0.5, 0.35);
  const keyM = mat('--bone', 0.6, 0.1);
  const tape = new THREE.Group();
  tape.position.set(-1.62, 0.03, 0.08);   // left of the radar, clear of the pilot file monitor
  tape.rotation.y = 0.12;   // turned a touch toward the pilot
  tape.scale.setScalar(0.85);
  slope.add(tape);
  rbox(0.56, 0.1, 0.34, 0.015, shellM, 0, 0.05, 0, tape);         // body
  box(0.36, 0.008, 0.21, darkM, -0.06, 0.1, -0.035, tape);         // cassette well
  // The cassette: a hand-labelled mix tape with two reels showing
  const paintLabel = (g, w, h) => {
    g.fillStyle = token('--cream'); g.fillRect(0, 0, w, h);
    g.fillStyle = token('--bebop-red'); g.fillRect(0, 18, w, 12);
    g.fillStyle = token('--amber'); g.fillRect(0, 30, w, 5);
    g.fillStyle = token('--space-black'); g.fillRect(60, 56, 136, 44);   // reel window
    g.fillStyle = token('--paper-ink'); g.font = '20px VT323, monospace';
    g.fillText('SIDE A  /  IT JUST IS...', 10, 14);
    g.font = '15px VT323, monospace';
    g.fillText('MIX', 10, 76); g.fillText('AG', 214, 76);
  };
  const labelTex = canvasTexture(256, 128, paintLabel);
  if (document.fonts) document.fonts.ready.then(() => { paintLabel(labelTex.image.getContext('2d'), 256, 128); labelTex.needsUpdate = true; });
  box(0.32, 0.016, 0.19, darkM, -0.06, 0.108, -0.035, tape);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8 }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(-0.06, 0.1165, -0.035);
  tape.add(label);
  const reels = [-0.105, -0.015].map((x) => {
    const r = new THREE.Group();
    r.position.set(x, 0.118, -0.025);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 6), keyM);
    r.add(hub);
    box(0.034, 0.005, 0.006, darkM, 0, 0.001, 0, r);   // a spoke so the spin shows
    tape.add(r);
    return r;
  });
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.21), new THREE.MeshStandardMaterial({
    color: color('--fan-light'), transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false,
  }));
  lid.rotation.x = -Math.PI / 2;
  lid.position.set(-0.06, 0.124, -0.035);
  tape.add(lid);
  // Piano keys along the front: rewind, play, fast forward, stop, eject
  const keys = [-0.22, -0.135, -0.05, 0.035, 0.12].map((x, k) =>
    box(0.075, 0.026, 0.06, k === 1 ? mat('--bebop-red', 0.5, 0.1) : keyM, x, 0.108, 0.125, tape));
  const playKey = keys[1];
  // Level meter and run lamp on the right
  const vu = Array.from({ length: 6 }, (_, k) => {
    const m = new THREE.MeshBasicMaterial({ color: color(k > 3 ? '--bebop-red' : '--amber'), toneMapped: false });
    box(0.07, 0.008, 0.018, m, 0.2, 0.102, -0.13 + k * 0.03, tape).castShadow = false;
    return { m, base: color(k > 3 ? '--bebop-red' : '--amber') };
  });
  const lampOn = color('--neon'), lampIdle = color('--amber'), lensC = color('--neon-cyan');
  const runLamp = new THREE.MeshBasicMaterial({ color: color('--amber'), toneMapped: false });
  box(0.03, 0.01, 0.03, runLamp, 0.2, 0.104, 0.1, tape);
  // The holo projector lens, where the music screen beams from
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.012, 16), glow('--neon-cyan'));
  lens.position.set(0.2, 0.106, 0.04);
  tape.add(lens);
  // The empty PHONES socket on the side, the headphone jack lying just short of it
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), mat('--space-black', 0.4, 0.8));
  socket.rotation.z = Math.PI / 2;
  socket.position.set(-0.282, 0.05, 0.1);
  tape.add(socket);
  // Click target, and the pose the camera leans in to
  const tapePad = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.22, 0.42), new THREE.MeshBasicMaterial({ visible: false }));
  tapePad.position.y = 0.08;
  tape.add(tapePad);
  const tapeAnchor = new THREE.Object3D();
  tapeAnchor.position.set(0, 0.1, 0);
  tapeAnchor.rotation.x = -0.9;   // look in from above and in front, like leaning over the console
  tape.add(tapeAnchor);
  const tapeTop = new THREE.Object3D();   // top of the back edge: the hologram stands above this
  tapeTop.position.set(0, 0.13, -0.18);
  tape.add(tapeTop);

  const phones = new THREE.Group();
  phones.position.set(-2.06, 0.03, -0.04);   // dropped beside the deck
  phones.rotation.y = 0.1;
  slope.add(phones);
  const cupM = mat('--soot', 0.45, 0.5);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.011, 8, 28, Math.PI), cupM);
  band.rotation.x = -Math.PI / 2;
  band.position.y = 0.016;
  phones.add(band);
  [-0.1, 0.1].forEach((x) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.032, 20), cupM);
    cup.position.set(x, 0.02, 0.012);
    phones.add(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.012, 8, 20), padM);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.038, 0.012);
    phones.add(ring);
    box(0.05, 0.004, 0.008, mat('--bebop-red', 0.5, 0.2), x, 0.004, 0.06, phones);   // red trim
  });
  // A loose cable, its jack lying unplugged
  const cable = new THREE.CatmullRomCurve3([V(0.1, 0.008, 0.05), V(0.17, 0.008, 0.12), V(0.09, 0.008, 0.2), V(0.15, 0.008, 0.27), V(0.19, 0.008, 0.25)]);
  phones.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 40, 0.004, 6, false), darkM));
  rod(V(0.19, 0.008, 0.25), V(0.215, 0.008, 0.245), 0.008, darkM, phones);
  rod(V(0.215, 0.008, 0.245), V(0.232, 0.008, 0.242), 0.004, mat('--amber', 0.3, 0.9), phones);

  // Buttons: little lit keys that blink at their own pace
  const buttons = [];
  const lightKinds = ['--neon', '--amber', '--bebop-red', '--floor-light', '--cream', '--neon-cyan'];
  const addButtons = (parent, cols, rows, x0b, z0b, step) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const name = lightKinds[(r * 7 + c * 3 + cols) % lightKinds.length];
      const m = new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });
      const b = box(0.07, 0.03, 0.05, m, x0b + c * step, 0.04, z0b + r * step, parent);
      b.castShadow = false;
      buttons.push({ m, base: color(name), period: 300 + Math.random() * 1800, phase: Math.random() * 3000, steady: Math.random() < 0.35 });
    }
  };
  addButtons(slope, 3, 2, 0.36, -0.39, 0.11);   // behind the throttle
  addButtons(slope, 4, 4, 1.2, -0.33, 0.11);
  slopes.forEach((top) => addButtons(top, 6, 4, -0.33, -0.22, 0.12));
  // Throttle and flight stick
  rod(V(CX - 1.7, FY + 0.75, -13.9), V(CX - 1.7, FY + 1.02, -13.8), 0.025, darkM);
  const stick = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glow('--bebop-red'));
  stick.position.set(CX - 1.7, FY + 1.05, -13.79);
  scene.add(stick);

  // Lights: cool overhead and a teal wash off the console
  const top = new THREE.PointLight(color('--fan-light'), small ? 10 : 16, 14, 2);
  top.position.set(CX, FY + H - 0.4, -10.2);
  scene.add(top);
  if (!small) {
    const dashGlow = new THREE.PointLight(color('--neon-cyan'), 3, 4, 2);
    dashGlow.position.set(CX, FY + 1.5, -14.6);
    scene.add(dashGlow);
  }

  /* ---------- Screen pictures ---------- */

  const planets = [
    ['MER', 0.12, 4.1], ['VEN', 0.2, 1.6], ['EAR', 0.28, 1.0], ['MAR', 0.36, 0.53],
    ['JUP', 0.52, 0.084], ['SAT', 0.64, 0.034], ['URA', 0.76, 0.012], ['NEP', 0.88, 0.006],
  ].map(([n, r, w], i) => ({ n, r, w, a: i * 1.7 }));

  const photo = new Image();
  photo.src = 'assets/aviraj.jpg';

  const drawRadar = (t) => {
    const g = radar.c.getContext('2d'), W = 256, c = W / 2, s = t / 1000;
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, W, W);
    g.strokeStyle = token('--neon'); g.globalAlpha = 0.3; g.lineWidth = 1;
    planets.forEach((p) => { g.beginPath(); g.arc(c, c, p.r * 120, 0, 6.283); g.stroke(); });
    g.beginPath(); g.moveTo(0, c); g.lineTo(W, c); g.moveTo(c, 0); g.lineTo(c, W); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = token('--amber'); g.beginPath(); g.arc(c, c, 6, 0, 6.283); g.fill();
    const sweep = (s * 1.4) % 6.283;
    g.strokeStyle = token('--neon'); g.lineWidth = 2;
    g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(sweep) * 120, c + Math.sin(sweep) * 120); g.stroke();
    g.font = '13px VT323, monospace';
    planets.forEach((p) => {
      const a = p.a + s * p.w * 0.6;
      const x = c + Math.cos(a) * p.r * 120, y = c + Math.sin(a) * p.r * 120;
      const ang = ((Math.atan2(y - c, x - c) + 6.283) % 6.283);
      const since = ((sweep - ang) + 6.283) % 6.283;   // how long ago the sweep passed it
      g.globalAlpha = 0.35 + 0.65 * Math.max(0, 1 - since / 2.5);
      g.fillStyle = p.n === 'EAR' ? token('--floor-light') : token('--neon');
      g.fillRect(x - 3, y - 3, 6, 6);
      g.fillText(p.n, x + 5, y - 4);
    });
    g.globalAlpha = 1;
    g.fillStyle = token('--neon');
    g.fillText('NAV SCAN / SOL SYSTEM', 8, 16);
    radar.tex.needsUpdate = true;
  };

  const drawStatus = (t) => {
    const g = status.c.getContext('2d'), s = t / 1000, k = thrustShown;
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, 256, 160);
    g.fillStyle = token(k > 0.85 ? '--bebop-red' : '--amber'); g.font = '18px VT323, monospace';
    g.fillText(k < 0.06 ? 'HYPERDRIVE  IDLE' : k > 0.85 ? 'HYPERDRIVE  FULL BURN' : 'HYPERDRIVE  ENGAGED', 10, 22);
    g.textAlign = 'right';
    g.fillText(`${String(Math.round(k * 100)).padStart(3, ' ')}%`, 246, 22);
    g.textAlign = 'left';
    // DRIVE reads the throttle; the shield thins and comms get noisier as speed builds
    const level = [
      0.04 + k * 0.96,
      0.95 - k * 0.45 + 0.04 * Math.sin(s * 0.7),
      0.8 + 0.1 * Math.sin(s * 0.3),
      0.6 + 0.3 * Math.abs(Math.sin(s * (0.9 + k * 6))),
    ];
    ['DRIVE', 'SHIELD', 'O2', 'COMMS'].forEach((n, i) => {
      const v = level[i];
      g.fillStyle = token('--ink-dim'); g.fillText(n, 10, 52 + i * 26);
      g.fillStyle = token(i === 0 ? '--neon-cyan' : '--neon');
      for (let k = 0; k < Math.round(v * 14); k++) g.fillRect(80 + k * 11, 40 + i * 26, 8, 14);
    });
    status.tex.needsUpdate = true;
  };

  const drawAbout = (t, hot) => {
    const g = about.c.getContext('2d');
    g.fillStyle = token('--screen-bg'); g.fillRect(0, 0, 320, 200);
    // The pilot, as amber halftone
    if (photo.complete && photo.naturalWidth) {
      const off = drawAbout.off || (drawAbout.off = (() => {
        const o = document.createElement('canvas'); o.width = 40; o.height = 48;
        o.getContext('2d').drawImage(photo, 40, 20, 320, 384, 0, 0, 40, 48);
        return o.getContext('2d').getImageData(0, 0, 40, 48).data;
      })());
      g.fillStyle = token('--amber');
      for (let y = 0; y < 48; y++) for (let x = 0; x < 40; x++) {
        const k = (y * 40 + x) * 4, lum = (off[k] * 0.3 + off[k + 1] * 0.59 + off[k + 2] * 0.11) / 255;
        const r = lum * 1.7;
        if (r > 0.2) { g.beginPath(); g.arc(16 + x * 3.4, 20 + y * 3.4, r, 0, 6.283); g.fill(); }
      }
    }
    g.fillStyle = token('--amber'); g.font = '30px VT323, monospace';
    g.fillText('PILOT FILE', 168, 46);
    g.fillStyle = token('--cream'); g.font = '22px VT323, monospace';
    g.fillText('A. GHATORA', 168, 78);
    g.fillStyle = token('--ink-dim'); g.font = '17px VT323, monospace';
    g.fillText('DATA + SOFTWARE', 168, 104);
    g.fillText('UOFT / EDC', 168, 124);
    if (hot || Math.floor(t / 500) % 2) { g.fillStyle = token('--neon'); g.fillText('> PRESS TO OPEN', 168, 172); }
    g.fillStyle = token('--screen-scan');
    for (let y = 0; y < 200; y += 3) g.fillRect(0, y, 320, 1);
    about.tex.needsUpdate = true;
  };

  const drawPort = (dt) => {
    const g = portCanvas.getContext('2d');
    g.fillStyle = token('--space-black'); g.fillRect(0, 0, 128, 128);
    portStreaks.forEach((p) => {
      if (motion()) { p.x += dt * (200 + p.l * 6); if (p.x - p.l > 128) { p.x = -10; p.y = Math.random() * 128; } }
      g.fillStyle = token(p.c); g.globalAlpha = 0.8;
      g.fillRect(p.x - p.l, p.y, p.l, 2);
    });
    g.globalAlpha = 1;
    portTex.needsUpdate = true;
  };

  let hot = false;
  let tapeHot = false;
  let playing = false;
  return {
    aboutScreen: about.mesh,
    aboutHits: [about.mesh],
    tapeHits: [tapePad],
    tapeAnchor,
    tapeLens: lens,
    tapeTop,
    ownSeat,
    seat: { pos: V(1.45, FY + 1.55, -13.3), target: V(2.15, FY + 1.05, -20) },   // eyes just in front of the headrest
    setHot(v) { hot = v; },
    throttleHits: [throttlePad],
    setThrust(k) { thrust = k; },
    setTapeHot(v) { tapeHot = v; },
    setPlaying(v) { playing = v; },
    update(t, dt) {
      if (motion()) platter.rotation.y -= dt * 3.5;   // 33 1/3 rpm
      buttons.forEach((b) => {
        const on = b.steady || !motion() || Math.floor((t + b.phase) / b.period) % 2 === 0;
        b.m.color.copy(b.base).multiplyScalar(on ? 1 : 0.15);
      });
      drawPort(dt);
      thrustShown += (thrust - thrustShown) * Math.min(1, dt * 1.8);   // matches the drive spooling
      lever.rotation.x += (leverAngle(thrust) - lever.rotation.x) * Math.min(1, dt * 14);
      // The deck: reels turn and the meter jumps while the playlist runs
      const run = playing && motion();
      if (run) reels.forEach((r) => { r.rotation.y -= dt * 2.4; });
      playKey.position.y = playing ? 0.1 : 0.108;
      vu.forEach((v, k) => {
        const lvl = playing ? (run ? 0.5 + 0.5 * Math.sin(t * 0.011 + k * 0.7) * Math.sin(t * 0.0047 + k) + 0.2 * Math.random() : 0.6) : 0;
        v.m.color.copy(v.base).multiplyScalar(lvl * 6 > k ? 1 : 0.12);
      });
      runLamp.color.copy(playing ? lampOn : lampIdle).multiplyScalar(playing || tapeHot || Math.floor(t / 700) % 2 ? 1 : 0.2);
      lens.material.color.copy(lensC).multiplyScalar(tapeHot ? 1 : 0.55);
    },
    redraw(t) { drawRadar(t); drawStatus(t); drawAbout(t, hot); },
  };
}

