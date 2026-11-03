(() => {
  'use strict';

  const root = document.documentElement;
  const css = getComputedStyle(root);
  const motion = () => root.classList.contains('fx-on');
  const hex = (name) => {
    const h = css.getPropertyValue(name).trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  /* ---------- Noise: value noise that wraps horizontally ---------- */

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fbm(seed, periods = [[6, 3], [12, 6], [24, 12], [48, 24], [96, 48]]) {
    const rand = rng(seed);
    const octaves = periods.map(([px, py]) => {
      const g = new Float32Array(px * (py + 1));
      for (let i = 0; i < g.length; i++) g[i] = rand();
      return { px, py, g };
    });
    const sample = ({ px, py, g }, x, y) => {
      const xi = Math.floor(x), yi = Math.min(Math.floor(y), py - 1);
      const fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
      const a = g[yi * px + x0], b = g[yi * px + x1];
      const c = g[(yi + 1) * px + x0], d = g[(yi + 1) * px + x1];
      return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    };
    // u wraps in [0,1); v runs pole to pole in [0,1]
    return (u, v) => {
      let sum = 0, amp = 0.5, norm = 0;
      for (const o of octaves) { sum += sample(o, u * o.px, v * o.py) * amp; norm += amp; amp *= 0.5; }
      return sum / norm;
    };
  }

  /* ---------- Earth ---------- */

  function earth() {
    const canvas = document.querySelector('[data-earth]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const C = {
      deep: hex('--earth-deep'), ocean: hex('--earth-ocean'), shallow: hex('--earth-shallow'),
      land: hex('--earth-land'), sand: hex('--earth-sand'), cloud: hex('--earth-cloud'), atmo: hex('--atmo'),
      glare: hex('--glare'), flareWarm: hex('--amber'),
    };

    // Equirectangular textures, built once
    const W = 512, H = 256;
    const land = fbm(7);
    // Clouds skip the broadest octave and stretch east-west into streaks
    const vapour = fbm(23, [[16, 4], [32, 10], [64, 20], [128, 40], [256, 80]]);
    const ground = new Uint8ClampedArray(W * H * 3);
    const cover = new Uint8ClampedArray(W * H);
    const water = new Uint8Array(W * H);      // where the sun can glint
    for (let j = 0; j < H; j++) {
      const v = (j + 0.5) / H;
      const polar = smooth(0.88, 0.97, Math.abs(v * 2 - 1));
      for (let i = 0; i < W; i++) {
        const u = i / W;
        const h = land(u, v);
        let col;
        if (h > 0.56) col = mix(C.land, C.sand, smooth(0.6, 0.75, h));
        else col = mix(mix(C.deep, C.ocean, smooth(0.3, 0.5, h)), C.shallow, smooth(0.5, 0.56, h));
        col = mix(col, C.cloud, polar * 0.85);
        const k = j * W + i;
        ground[k * 3] = col[0]; ground[k * 3 + 1] = col[1]; ground[k * 3 + 2] = col[2];
        cover[k] = smooth(0.52, 0.66, vapour(u, v)) * 230;
        water[k] = h <= 0.56 && polar < 0.5 ? 1 : 0;
      }
    }

    // Per-pixel lookup for the disc: texture column, row, light, rim.
    // Each frame only shifts the column by the spin, so drawing is one pass of
    // array reads with no trig.
    let D = 0, pad = 0, out = null, idx = null, lon = null, row = null, light = null, rim = null, glint = null, n = 0;
    let L = [0.62, -0.42, 0.66];

    const layout = () => {
      const box = canvas.getBoundingClientRect();
      const size = box.width;
      D = Math.round(Math.min(420, Math.max(220, size * 0.4)));
      pad = Math.round(D * 0.05);
      const S = D + pad * 2;
      canvas.width = canvas.height = S;
      out = ctx.createImageData(S, S);

      // The sun sits just past whichever upper edge of the planet is on screen
      const onRight = box.left + box.width / 2 > window.innerWidth / 2;
      L = [onRight ? -0.42 : 0.42, -0.72, 0.55];
      const hl = Math.hypot(L[0], L[1], L[2] + 1);
      const Hv = [L[0] / hl, L[1] / hl, (L[2] + 1) / hl];   // half-vector for the glint

      const r = D / 2;
      const cap = Math.ceil(Math.PI * r * r) + 4 * D;
      idx = new Uint32Array(cap); lon = new Float32Array(cap); row = new Uint16Array(cap);
      light = new Float32Array(cap); rim = new Float32Array(cap); glint = new Float32Array(cap);
      n = 0;
      for (let y = 0; y < D; y++) {
        const ny = ((y + 0.5) - r) / r;
        for (let x = 0; x < D; x++) {
          const nx = ((x + 0.5) - r) / r;
          const d2 = nx * nx + ny * ny;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          const lat = Math.asin(ny);
          const ring = Math.sqrt(1 - ny * ny) || 1e-6;
          idx[n] = (y + pad) * S + (x + pad);
          lon[n] = ((Math.asin(Math.max(-1, Math.min(1, nx / ring))) + Math.PI / 2) / (2 * Math.PI)) * W;
          row[n] = Math.min(H - 1, Math.floor((lat / Math.PI + 0.5) * H));
          const lambert = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
          light[n] = 0.1 + 1.0 * Math.pow(lambert, 0.85);
          rim[n] = Math.pow(1 - nz, 3) * (0.35 + lambert);
          const nh = Math.max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]);
          glint[n] = Math.pow(nh, 70) * 1.6 + Math.pow(nh, 9) * 0.22;
          n++;
        }
      }
    };

    const draw = (t) => {
      const spin = ((t / 1000) / 150) * W;    // one turn every 150s
      const drift = ((t / 1000) / 105) * W;   // clouds slip ahead of the ground
      const px = out.data;
      const [ar, ag, ab] = C.atmo;
      for (let i = 0; i < n; i++) {
        const base = row[i] * W;
        const g = (base + (((lon[i] + spin) | 0) % W)) * 3;
        const ca = cover[base + (((lon[i] + drift) | 0) % W)] / 255;
        const l = light[i], e = rim[i];
        // Sun glint off open water, dimmed under cloud
        const sp = glint[i] * water[g / 3] * (1 - ca) * 255;
        const o = idx[i] * 4;
        px[o]     = ((ground[g]     + (C.cloud[0] - ground[g])     * ca) * l) + ar * e + sp;
        px[o + 1] = ((ground[g + 1] + (C.cloud[1] - ground[g + 1]) * ca) * l) + ag * e + sp * 0.97;
        px[o + 2] = ((ground[g + 2] + (C.cloud[2] - ground[g + 2]) * ca) * l) + ab * e + sp * 0.88;
        px[o + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);

      // Thin atmosphere hugging the lit limb
      const r = D / 2, c = pad + r;
      const sunAng = Math.atan2(L[1], L[0]);
      const a = ctx.createRadialGradient(c, c, r * 0.98, c, c, r * 1.06);
      a.addColorStop(0, rgba(C.atmo, 0.5));
      a.addColorStop(1, rgba(C.atmo, 0));
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(c, c, r * 1.06, sunAng - Math.PI * 0.7, sunAng + Math.PI * 0.7);
      ctx.arc(c, c, r * 0.98, sunAng + Math.PI * 0.7, sunAng - Math.PI * 0.7, true);
      ctx.fill();

      flare(t);
    };

    /* Sun glare: the sun just behind the limb, with a starburst, an
       anamorphic streak and lens ghosts. Drawn on its own full-screen layer. */
    const glare = document.querySelector('[data-glare]');
    const gctx = glare && glare.getContext('2d');
    const sizeGlare = () => {
      if (!glare) return;
      glare.width = window.innerWidth;
      glare.height = window.innerHeight;
    };
    function flare(t) {
      if (!gctx) return;
      const W2 = glare.width, H2 = glare.height;
      gctx.clearRect(0, 0, W2, H2);
      const box = canvas.getBoundingClientRect();
      const R = (box.width / 2) * (D / (D + pad * 2));
      const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      const len = Math.hypot(L[0], L[1]);
      const dx = L[0] / len, dy = L[1] / len;
      const px = cx + dx * R * 1.005, py = cy + dy * R * 1.005;
      const k = 0.88 + 0.08 * Math.sin(t * 0.0011) + 0.04 * Math.sin(t * 0.0047);   // slow breathing
      const cream = C.glare, warm = C.flareWarm;

      // Wide halo
      let g = gctx.createRadialGradient(px, py, 0, px, py, R * 0.7);
      g.addColorStop(0, rgba(cream, 0.75 * k));
      g.addColorStop(0.25, rgba(C.atmo, 0.24 * k));
      g.addColorStop(1, rgba(C.atmo, 0));
      gctx.fillStyle = g;
      gctx.fillRect(px - R, py - R, R * 2, R * 2);

      // Anamorphic streak
      gctx.save();
      gctx.translate(px, py);
      gctx.scale(1, 0.025);
      g = gctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.2);
      g.addColorStop(0, rgba(cream, 0.85 * k));
      g.addColorStop(0.4, rgba(C.atmo, 0.25 * k));
      g.addColorStop(1, rgba(C.atmo, 0));
      gctx.fillStyle = g;
      gctx.fillRect(-R * 2.2, -R * 2.2, R * 4.4, R * 4.4);
      gctx.restore();

      // Starburst rays, turning very slowly
      gctx.save();
      gctx.translate(px, py);
      gctx.rotate(t * 0.00004);
      for (let i = 0; i < 6; i++) {
        gctx.rotate(Math.PI / 3);
        const rl = R * (i % 2 ? 0.28 : 0.45) * k;
        g = gctx.createLinearGradient(0, 0, rl, 0);
        g.addColorStop(0, rgba(cream, 0.7 * k));
        g.addColorStop(1, rgba(cream, 0));
        gctx.fillStyle = g;
        gctx.fillRect(0, -0.75, rl, 1.5);
      }
      gctx.restore();

      // Hot core
      g = gctx.createRadialGradient(px, py, 0, px, py, R * 0.09);
      g.addColorStop(0, rgba(cream, k));
      g.addColorStop(1, rgba(cream, 0));
      gctx.fillStyle = g;
      gctx.beginPath(); gctx.arc(px, py, R * 0.09, 0, Math.PI * 2); gctx.fill();

      // Lens ghosts along the line through the screen centre
      const vx = W2 / 2 - px, vy = H2 / 2 - py;
      [[0.45, 0.05, warm, 0.10], [0.75, 0.11, C.atmo, 0.06], [1.15, 0.07, warm, 0.07], [1.5, 0.16, C.atmo, 0.04]].forEach(([f, s, col, a]) => {
        const gx = px + vx * f, gy = py + vy * f, gr = R * s;
        gctx.fillStyle = rgba(col, a * k);
        gctx.beginPath(); gctx.arc(gx, gy, gr, 0, Math.PI * 2); gctx.fill();
        gctx.strokeStyle = rgba(col, a * 1.6 * k);
        gctx.lineWidth = 1;
        gctx.stroke();
      });
    }
    sizeGlare();

    layout();
    let last = 0;
    const loop = (t) => {
      if (motion() && t - last > 50) { draw(t); last = t; }
      requestAnimationFrame(loop);
    };
    draw(0);
    requestAnimationFrame(loop);

    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { sizeGlare(); layout(); draw(performance.now()); }, 200); });

    // A little parallax against the pointer
    window.addEventListener('pointermove', (e) => {
      if (!motion() || e.pointerType !== 'mouse') return;
      const x = (e.clientX / window.innerWidth - 0.5) * -14;
      const y = (e.clientY / window.innerHeight - 0.5) * -10;
      canvas.style.translate = `${x}px ${y}px`;
    }, { passive: true });
  }

  /* ---------- Stars ---------- */

  function stars() {
    const canvas = document.querySelector('[data-stars]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const tones = [hex('--cream'), hex('--amber'), hex('--star-cool')];
    let w = 0, h = 0, dpr = 1, field = [];
    let shot = null, nextShot = 4000;

    const layout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const rand = rng(91);
      // Dense field: mostly faint dust-sized stars, a few bright ones
      const n = Math.min(1100, Math.round((w * h) / 1500));
      field = Array.from({ length: n }, () => {
        const size = 0.35 + Math.pow(rand(), 4) * 1.9;
        const pick = rand();
        return {
          x: rand() * w, y: rand() * h, size,
          base: 0.35 + rand() * 0.65,
          speed: 1.5 + size * 4,                  // bigger = nearer = faster drift
          tw: 0.6 + rand() * 2.2, phase: rand() * 6.28,
          tone: pick < 0.8 ? 0 : pick < 0.92 ? 1 : 2,
        };
      });
    };

    const draw = (t, dt) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const live = motion();
      for (const s of field) {
        if (live) { s.x -= s.speed * dt; if (s.x < -2) s.x += w + 4; }
        const a = live ? s.base * (0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.phase)) : s.base;
        ctx.fillStyle = rgba(tones[s.tone], a);
        ctx.fillRect(s.x, s.y, s.size, s.size);
        if (s.size > 1.5) { // cross flare on the brightest
          ctx.fillStyle = rgba(tones[s.tone], a * 0.35);
          ctx.fillRect(s.x - s.size, s.y + s.size / 2 - 0.5, s.size * 3, 1);
          ctx.fillRect(s.x + s.size / 2 - 0.5, s.y - s.size, 1, s.size * 3);
        }
      }

      if (!live) return;
      // Occasional shooting star
      nextShot -= dt * 1000;
      if (!shot && nextShot <= 0) {
        shot = { x: w * (0.3 + Math.random() * 0.7), y: h * Math.random() * 0.4, life: 0, len: 120 + Math.random() * 120, ang: Math.PI * (0.78 + Math.random() * 0.1) };
        nextShot = 7000 + Math.random() * 9000;
      }
      if (shot) {
        shot.life += dt / 0.9;
        const p = shot.life;
        const hx = shot.x + Math.cos(shot.ang) * p * 520, hy = shot.y + Math.sin(shot.ang) * p * 520;
        const tx = hx - Math.cos(shot.ang) * shot.len, ty = hy - Math.sin(shot.ang) * shot.len;
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, rgba(tones[0], 0));
        g.addColorStop(1, rgba(tones[0], 0.9 * (1 - p)));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        if (p >= 1) shot = null;
      }
    };

    layout();
    let prev = performance.now(), lastDraw = 0;
    const loop = (t) => {
      if (motion() && t - lastDraw > 33) { draw(t, Math.min(0.1, (t - prev) / 1000)); prev = t; lastDraw = t; }
      else if (!motion()) prev = t;
      requestAnimationFrame(loop);
    };
    draw(0, 0);
    requestAnimationFrame(loop);

    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { layout(); draw(performance.now(), 0); }, 200); });
  }

  /* ---------- Retro meteors behind the bounty board ---------- */

  function meteors() {
    const canvas = document.querySelector('[data-meteors]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const PX = 3;                       // one "pixel" = 3 screen px, drawn crisp
    const rock = [hex('--bone'), hex('--amber'), hex('--chart-ink')];
    const trail = [hex('--amber'), hex('--bebop-red')];
    let w = 0, h = 0, list = [], next = 1200, visible = false, last = 0;

    const size = () => {
      w = Math.ceil(canvas.clientWidth / PX);
      h = Math.ceil(canvas.clientHeight / PX);
      canvas.width = w; canvas.height = h;
    };

    // A lumpy block of 3-6 pixels across, with a lit and a dark side
    const shape = (n) => {
      const cells = [];
      const c = (n - 1) / 2;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d <= c + 0.3 - Math.random() * 0.6) cells.push([x, y, x + y < n - 1 ? 0 : x + y > n + 1 ? 2 : 1]);
      }
      return cells;
    };

    // Enter from the top or right edge of the part of the section on screen
    const spawn = () => {
      const n = 3 + ((Math.random() * 4) | 0);
      const ang = Math.PI * (0.80 + Math.random() * 0.12);    // heading down and to the left
      const speed = 90 + Math.random() * 80;
      const box = canvas.getBoundingClientRect();
      const top = Math.max(0, -box.top) / PX;
      const view = Math.min(window.innerHeight, box.bottom) / PX - top;
      const fromTop = Math.random() < 0.6;
      list.push({
        x: fromTop ? w * (0.3 + Math.random() * 0.7) : w + n,
        y: fromTop ? top - n : top + Math.random() * view * 0.5,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        n, cells: shape(n), len: 10 + ((Math.random() * 14) | 0),
      });
    };

    const draw = (dt) => {
      ctx.clearRect(0, 0, w, h);
      for (const m of list) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        const x = Math.round(m.x), y = Math.round(m.y);
        // Stepped trail: every other pixel back along the path, fading out
        const ux = -m.vx / Math.hypot(m.vx, m.vy), uy = -m.vy / Math.hypot(m.vx, m.vy);
        for (let i = 1; i <= m.len; i++) {
          if (i % 2) continue;
          const a = 1 - i / m.len;
          ctx.fillStyle = rgba(trail[i < m.len * 0.4 ? 0 : 1], a * 0.8);
          ctx.fillRect(Math.round(x + m.n / 2 + ux * i * 1.6), Math.round(y + m.n / 2 + uy * i * 1.6), 1, 1);
        }
        for (const [cx, cy, tone] of m.cells) {
          ctx.fillStyle = rgba(rock[tone], 1);
          ctx.fillRect(x + cx, y + cy, 1, 1);
        }
      }
      list = list.filter((m) => m.x > -40 && m.y < h + 40);
    };

    const loop = (t) => {
      if (visible && motion()) {
        const dt = Math.min(0.1, (t - last) / 1000);
        if (t - last > 33) {
          next -= dt * 1000;
          if (next <= 0 && list.length < 3) { spawn(); next = 2500 + Math.random() * 4500; }
          draw(dt);
          last = t;        }
      } else last = t;
      requestAnimationFrame(loop);
    };

    size();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible) { list = []; ctx.clearRect(0, 0, w, h); } }).observe(canvas);
    window.addEventListener('resize', size);
    requestAnimationFrame(loop);
  }

  /* ---------- A ship crossing the Open a Channel section ---------- */

  function flyby() {
    const lane = document.querySelector('[data-flyby]');
    if (!lane) return;
    let visible = false, timer = 0;

    const launch = () => {
      if (!visible || !motion() || lane.classList.contains('is-flying')) { schedule(); return; }
      const ltr = Math.random() < 0.75;
      // Fly the open band under the console, never behind it
      const sec = lane.parentElement;
      const con = sec.querySelector('.console');
      const ship = lane.querySelector('.ship');
      const floor = con ? con.offsetTop + con.offsetHeight + 16 : sec.clientHeight * 0.75;
      const room = Math.max(0, sec.clientHeight - floor - ship.getBoundingClientRect().height - 8);
      lane.style.setProperty('--fy', `${Math.round(floor + Math.random() * room)}px`);
      lane.style.setProperty('--fdur', `${6 + Math.random() * 4}s`);
      lane.style.setProperty('--fscale', `${0.7 + Math.random() * 0.5}`);
      lane.classList.toggle('is-rtl', !ltr);
      lane.classList.add('is-flying');
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(launch, 7000 + Math.random() * 9000); };

    lane.addEventListener('animationend', (e) => {
      if (!e.target.classList.contains('ship')) return;   // ignore the exhaust flicker
      lane.classList.remove('is-flying');
      schedule();
    });
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      // First pass comes soon after the section scrolls into view
      if (visible && !lane.classList.contains('is-flying')) { clearTimeout(timer); timer = setTimeout(launch, 1500); }
    }, { threshold: 0.2 }).observe(lane.parentElement);
  }

  stars();
  earth();
  meteors();
  flyby();
})();
