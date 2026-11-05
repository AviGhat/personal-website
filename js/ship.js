import * as THREE from 'three';

/* ==========================================================
   The ship's exterior, seen once she's landed: an original
   long-haul workhorse in weathered tan plating. A faceted hull
   with a flight deck on top, a raised bridge aft, a collar, a
   pale engine section with three fins, and four landing legs.
   Nose toward -z; the pads sit at y = 0.
   ========================================================== */

export function buildShip({ color, token, canvasTexture, small }) {
  const ship = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mat = (name, rough = 0.7, metal = 0.35, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: rough, metalness: metal, ...extra });
  const glow = (name) => new THREE.MeshBasicMaterial({ color: color(name), toneMapped: false });
  const add = (m, parent = ship) => { m.castShadow = m.receiveShadow = !small; parent.add(m); return m; };
  const box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return add(o, parent); };
  const rod = (a, b, r, m) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), m);
    o.position.copy(a).addScaledVector(dir, 0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return add(o);
  };

  // Weathered plating: panel seams, rivets, grime and a little rust
  const plateTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = token('--ship-tan'); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = token(i % 3 ? '--ship-tan-dark' : '--rail');
      g.globalAlpha = 0.08 + Math.random() * 0.14;
      g.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 50, 6 + Math.random() * 30);
    }
    g.globalAlpha = 1;
    g.strokeStyle = token('--ship-tan-dark'); g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = token('--ship-tan-dark');
    for (let x = 6; x < w; x += 16) for (let y = 6; y < h; y += 42) g.fillRect(x, y, 2, 2);
  }, [3, 2]);
  // Lofted hull panels are seen from both sides, so no face ever drops out with the view angle
  const hullM = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.75, metalness: 0.3, side: THREE.DoubleSide });
  const darkM = mat('--hull-dark', 0.6, 0.5, { side: THREE.DoubleSide });
  const paleM = mat('--bone', 0.55, 0.25);
  const redM = mat('--bebop-red', 0.6, 0.2);

  // The hull's cross-section: a flattened hexagon, flat deck on top
  const HEX = [[-1.0, 0.75], [1.0, 0.75], [1.45, 0], [1.0, -0.75], [-1.0, -0.75], [-1.45, 0]];
  const Y0 = 2.0;   // hull centre height when landed
  // Join two hexagon rings (scaled and shifted) into a tapering section, capped at the far end
  const loft = (sa, za, sb, zb, yb = 0, m = hullM, cap = true) => {
    const ring = (s, z, dy) => HEX.map(([x, y]) => V(x * s, y * s + Y0 + dy, z));
    const a = ring(sa, za, 0), b = ring(sb, zb, yb);
    const pos = [];
    const tri = (p, q, r) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      if (zb < za) { tri(a[i], b[i], b[j]); tri(a[i], b[j], a[j]); } else { tri(a[i], b[j], b[i]); tri(a[i], a[j], b[j]); }
    }
    if (cap) {
      const c = V(0, Y0 + yb, zb);
      for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; if (zb < za) tri(c, b[j], b[i]); else tri(c, b[i], b[j]); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    // Planar UVs off x/z so the plate texture lies along the hull
    const uv = [];
    for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 0.2 + 0.5, pos[i + 2] * 0.12);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return add(new THREE.Mesh(geo, m));
  };

  // Body, wedge nose, and the neck aft
  loft(1, -3.2, 1, 3.2, 0, hullM, false);
  loft(1, -3.2, 0.36, -5.7, -0.25);
  loft(1, 3.2, 0.62, 4.1, 0, darkM);
  // Collar where the hull meets the neck
  loft(1.1, 2.75, 1.1, 3.15, 0, darkM, false);
  loft(1.1, 3.15, 1.1, 2.75, 0, darkM, false);

  // Flight deck: slate plate with landing markings and red edge strips
  const deckTex = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = token('--ship-deck'); g.fillRect(0, 0, w, h);
    g.strokeStyle = token('--cream'); g.globalAlpha = 0.5; g.lineWidth = 3;
    g.beginPath(); g.arc(w / 2, h * 0.38, 34, 0, Math.PI * 2); g.stroke();
    g.setLineDash([10, 8]); g.beginPath(); g.moveTo(w / 2, h * 0.6); g.lineTo(w / 2, h - 10); g.stroke();
    g.globalAlpha = 1;
  });
  box(1.9, 0.04, 4.8, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85, metalness: 0.2 }), 0, Y0 + 0.77, -0.7);
  [-1, 1].forEach((s) => box(0.06, 0.05, 4.8, redM, s * 0.98, Y0 + 0.79, -0.7));

  // Bridge: a stepped block aft of the deck with a lit window band
  box(1.5, 0.6, 1.3, hullM, 0, Y0 + 1.05, 2.1);
  box(1.0, 0.36, 0.9, hullM, 0, Y0 + 1.53, 2.25);
  box(1.52, 0.1, 0.02, glow('--amber'), 0, Y0 + 1.18, 1.44).castShadow = false;
  box(1.02, 0.08, 0.02, glow('--amber'), 0, Y0 + 1.6, 1.79).castShadow = false;
  rod(V(0.3, Y0 + 1.7, 2.4), V(0.3, Y0 + 2.5, 2.4), 0.02, darkM);   // antenna
  rod(V(-0.35, Y0 + 1.7, 2.5), V(-0.35, Y0 + 2.2, 2.5), 0.02, darkM);

  // Engine section: a pale drum with a dark vent ring and a glowing nozzle
  const drum = add(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.18, 2.5, 22), paleM));
  drum.rotation.x = Math.PI / 2;
  drum.position.set(0, Y0, 5.35);
  const vent = add(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 22, 1, true), darkM));
  vent.rotation.x = Math.PI / 2;
  vent.position.set(0, Y0, 4.2);
  const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.8, 22), glow('--amber'));
  nozzle.position.set(0, Y0, 6.61);
  ship.add(nozzle);
  // Three fins round the drum
  const finShape = new THREE.Shape([new THREE.Vector2(1.0, 0), new THREE.Vector2(2.5, 0.6), new THREE.Vector2(2.5, 1.5), new THREE.Vector2(1.0, 2.3)]);
  [Math.PI / 2, Math.PI / 2 + 2.1, Math.PI / 2 - 2.1].forEach((a) => {
    const g = new THREE.Group();
    g.position.set(0, Y0, 4.3);
    g.rotation.z = a;
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: false }), hullM);
    fin.rotation.x = Math.PI / 2;
    add(fin, g);
    ship.add(g);
  });

  // Side details on the upper facets: portholes, a hatch, the call sign
  const facet = Math.atan2(0.514, 0.857);
  [-1, 1].forEach((s) => {
    const side = new THREE.Group();
    side.position.set(s * 1.225, Y0 + 0.375, 0);
    side.rotation.z = s > 0 ? facet : Math.PI - facet;
    ship.add(side);
    [-2.2, -1.2, -0.2].forEach((z) => {
      const port = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), glow('--lamp-warm'));
      port.rotation.y = Math.PI / 2;
      port.position.set(0.02, 0, z);
      side.add(port);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 16), darkM);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(0.02, 0, z);
      side.add(rim);
    });
    box(0.03, 0.34, 0.7, paleM, 0.01, 0, 1.2, side);   // hatch
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.3), new THREE.MeshStandardMaterial({ map: canvasTexture(256, 64, (g, w, h) => {
      g.fillStyle = token('--ship-tan-dark'); g.fillRect(0, 0, w, h);
      g.fillStyle = token('--cream'); g.font = 'bold 40px Syncopate, sans-serif'; g.fillText('AG-TRN', 18, 48);
    }), roughness: 0.7 }));
    sign.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    sign.position.set(0.02, 0, s > 0 ? 0.6 : 0.6);
    side.add(sign);
    // Vent grilles low on the hull
    for (let k = 0; k < 4; k++) box(0.03, 0.06, 0.5, darkM, s * 1.3, Y0 - 0.25 + k * 0.1, -1.2);
  });

  // Landing legs and pads
  [[-1, -2.6], [1, -2.6], [-1, 2.4], [1, 2.4]].forEach(([s, z]) => {
    rod(V(s * 0.85, Y0 - 0.7, z), V(s * 1.45, 0.08, z + 0.15), 0.08, darkM);
    rod(V(s * 0.6, Y0 - 0.7, z + 0.5), V(s * 1.4, 0.4, z + 0.15), 0.04, darkM);
    const pad = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 12), darkM));
    pad.position.set(s * 1.45, 0.05, z + 0.15);
  });

  // Landing jets under the belly, lit only while she comes down or lifts off
  const thrusters = [[-0.7, -1.8], [0.7, -1.8], [-0.7, 1.8], [0.7, 1.8]].map(([x, z]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 10, 1, true), new THREE.MeshBasicMaterial({ color: color('--amber'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    c.position.set(x, Y0 - 1.55, z);
    c.rotation.x = Math.PI;
    c.visible = false;
    ship.add(c);
    return c;
  });

  const hits = [];
  ship.traverse((o) => { if (o.isMesh && !thrusters.includes(o)) hits.push(o); });
  return { ship, thrusters, hits };
}
