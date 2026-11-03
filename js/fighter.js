/* ==========================================================
   Dock 9 Brawl: the lounge arcade cabinet's fighting game.
   An original two-fighter brawler drawn in code at 320x180:
   Rio Vega (fast, throws a flare) and Brass (heavy, piston arm).
   One player against the CPU, best of three rounds.
   ========================================================== */

const W = 320, H = 180, FLOOR = 158;
const GRAVITY = 0.22;
const ROUND_TIME = 60;
const S = 1.4;   // fighters are drawn and measured at this scale

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
const sfx = (kind) => { try { if (window.agSound && window.agSound.fx) window.agSound.fx(kind); } catch (e) { /* ignore */ } };

/* ---------- The roster ---------- */

const ROSTER = [
  {
    id: 'rio', name: 'RIO VEGA', tag: 'Bounty hunter. Quick hands, quicker feet.',
    walk: 1.3, jump: 4.7, armour: 1, build: 9,
    look: { jacket: '--bebop-red', pants: '--soot', hair: '--fx-hair', band: '--cream', arm: '--fx-skin', fist: '--fx-skin' },
    moves: {
      punch: { s: 4, a: 3, r: 8, dmg: 5, from: 6, reach: 24, y: [-40, -30], lvl: 'mid', kb: 1.6, stun: 13, snd: 'hit' },
      kick: { s: 6, a: 4, r: 12, dmg: 8, from: 4, reach: 31, y: [-30, -16], lvl: 'mid', kb: 2.6, stun: 16, snd: 'heavy' },
      low: { s: 6, a: 4, r: 14, dmg: 6, from: 4, reach: 32, y: [-8, 0], lvl: 'low', kb: 1.8, stun: 15, snd: 'hit' },
      air: { s: 4, a: 10, r: 4, dmg: 7, from: 2, reach: 25, y: [-26, -6], lvl: 'high', kb: 2, stun: 15, snd: 'hit' },
      special: { kind: 'flare', name: 'FLARE SHOT', s: 12, a: 1, r: 20, dmg: 9, cool: 80 },
    },
  },
  {
    id: 'brass', name: 'BRASS', tag: 'Retired dock cop. One arm is a piston.',
    walk: 0.95, jump: 4.25, armour: 0.85, build: 12,
    look: { jacket: '--fx-coat', pants: '--fx-denim', hair: '--fx-boot', band: '--amber', arm: '--fx-steel', fist: '--fx-brass' },
    moves: {
      punch: { s: 5, a: 3, r: 10, dmg: 7, from: 6, reach: 27, y: [-40, -30], lvl: 'mid', kb: 2, stun: 13, snd: 'hit' },
      kick: { s: 8, a: 4, r: 14, dmg: 10, from: 4, reach: 31, y: [-30, -16], lvl: 'mid', kb: 3, stun: 17, snd: 'heavy' },
      low: { s: 7, a: 4, r: 15, dmg: 8, from: 4, reach: 31, y: [-8, 0], lvl: 'low', kb: 2, stun: 15, snd: 'heavy' },
      air: { s: 5, a: 9, r: 5, dmg: 9, from: 2, reach: 25, y: [-26, -6], lvl: 'high', kb: 2.4, stun: 15, snd: 'heavy' },
      special: { kind: 'rush', name: 'PISTON RUSH', s: 10, a: 16, r: 18, dmg: 13, from: 6, reach: 28, y: [-40, -24], lvl: 'mid', kb: 4.2, stun: 20, cool: 100, snd: 'heavy' },
    },
  },
];

/* ---------- Fighters ---------- */

function makeFighter(def, x, face) {
  return {
    def, x, y: FLOOR, vx: 0, vy: 0, face, hp: 100, shown: 100,
    state: 'idle', t: 0, move: null, moveKey: '', hit: false,
    stun: 0, cool: 0, walkT: 0, crouch: false, blocking: false, wins: 0,
  };
}

const grounded = (f) => f.y >= FLOOR;
const busy = (f) => ['attack', 'hitstun', 'blockstun', 'fall', 'down', 'ko', 'win'].includes(f.state);

export function createFighter(canvas) {
  const g = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  g.imageSmoothingEnabled = false;

  // Colours are read from the site's tokens once the fonts and CSS are in
  const C = {};
  const col = (name) => C[name] || (C[name] = token(name));

  /* ---------- Input ---------- */

  const KEYS = {
    arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
    j: 'punch', z: 'punch', k: 'kick', x: 'kick', l: 'special', c: 'special', enter: 'start', ' ': 'start',
  };
  const held = {};
  const pressed = {};
  const press = (name, on) => {
    if (on && !held[name]) pressed[name] = true;
    held[name] = on;
  };
  const onKey = (e) => {
    const name = KEYS[e.key.toLowerCase()];
    if (!name || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('button, a, input') && (name === 'start')) return;   // Enter on a button stays a click
    e.preventDefault();
    press(name, e.type === 'keydown');
  };
  const take = (name) => { const p = pressed[name]; pressed[name] = false; return p; };

  /* ---------- Match state ---------- */

  let scene = 'title';   // title | select | intro | fight | roundEnd | over
  let sceneT = 0;
  let pick = 0;
  let p1 = null, p2 = null;
  let round = 1;
  let clock = ROUND_TIME * 60;
  let banner = '';
  let hitstop = 0;
  let shake = 0;
  const sparks = [];
  const shots = [];
  const cpu = { wait: 0, plan: null, planT: 0 };

  const startMatch = () => {
    p1 = makeFighter(ROSTER[pick], 90, 1);
    p2 = makeFighter(ROSTER[1 - pick], 230, -1);
    round = 1;
    startRound();
  };
  const startRound = () => {
    [p1, p2].forEach((f, k) => {
      Object.assign(f, { x: k ? 230 : 90, y: FLOOR, vx: 0, vy: 0, face: k ? -1 : 1, hp: 100, shown: 100, state: 'idle', t: 0, move: null, stun: 0, cool: 0, crouch: false, blocking: false });
    });
    shots.length = 0;
    sparks.length = 0;
    clock = ROUND_TIME * 60;
    scene = 'intro';
    sceneT = 0;
    banner = `ROUND ${round}`;
    sfx('blip');
  };

  /* ---------- One fighter's tick ---------- */

  function control(f, foe, inp) {
    const toward = Math.sign(foe.x - f.x) || f.face;
    if (grounded(f) && !busy(f)) f.face = toward;
    const back = f.face > 0 ? inp.left : inp.right;
    const fwd = f.face > 0 ? inp.right : inp.left;
    f.blocking = false;
    if (f.cool > 0) f.cool--;

    if (f.state === 'attack') {
      f.t++;
      const m = f.move;
      if (f.moveKey === 'special' && m.kind === 'rush' && f.t >= m.s && f.t < m.s + m.a) f.vx = 3.6 * f.face;
      if (f.moveKey === 'special' && m.kind === 'flare' && f.t === m.s) {
        shots.push({ owner: f, x: f.x + f.face * 14 * S, y: f.y - 33 * S, vx: 2.6 * f.face, life: 160, dmg: m.dmg });
        sfx('whiff');
      }
      if (f.t === m.s && m.kind !== 'flare') sfx('whiff');
      if (f.t >= m.s + m.a + m.r && (grounded(f) || f.moveKey !== 'air')) { f.state = 'idle'; f.move = null; f.vx = 0; }
      return;
    }
    if (f.state === 'hitstun' || f.state === 'blockstun') {
      if (--f.stun <= 0) f.state = 'idle';
      return;
    }
    if (f.state === 'down') { if (--f.stun <= 0) f.state = 'idle'; return; }
    if (busy(f)) return;

    if (!grounded(f)) {
      // In the air: one jump attack per jump
      if ((inp.punchP || inp.kickP) && !f.airUsed) { f.airUsed = true; attack(f, 'air'); }
      return;
    }

    f.crouch = inp.down;
    if (inp.specialP && f.cool <= 0) { f.cool = f.def.moves.special.cool; attack(f, 'special'); return; }
    if (inp.punchP) { attack(f, f.crouch ? 'low' : 'punch'); return; }
    if (inp.kickP) { attack(f, f.crouch ? 'low' : 'kick'); return; }
    if (inp.up && !f.crouch) {
      f.vy = -f.def.jump;
      f.vx = (fwd ? 1.5 : back ? -1.5 : 0) * f.face;
      f.state = 'jump';
      f.airUsed = false;
      return;
    }
    f.blocking = back;
    if (f.crouch) { f.vx = 0; f.state = 'idle'; return; }
    if (fwd || back) {
      f.vx = (fwd ? f.def.walk : -f.def.walk * 0.8) * f.face;
      f.state = 'walk';
      f.walkT += 0.25;
    } else {
      f.vx = 0;
      f.state = 'idle';
    }
  }

  function attack(f, key) {
    f.state = 'attack';
    f.moveKey = key;
    f.move = f.def.moves[key];
    f.t = 0;
    f.hit = false;
    if (key !== 'air' && key !== 'special') f.vx = 0;
    if (key === 'special') f.vx = 0;
  }

  function physics(f) {
    if (!grounded(f) || f.vy < 0) {
      f.vy += GRAVITY;
      f.y += f.vy;
      if (f.y >= FLOOR) {
        f.y = FLOOR;
        f.vy = 0;
        if (f.state === 'fall') { f.state = 'down'; f.stun = 26; f.vx = 0; }
        else if (f.state === 'jump' || (f.state === 'attack' && f.moveKey === 'air')) { f.state = 'idle'; f.move = null; f.vx = 0; }
        else f.vx = 0;
      }
    }
    f.x += f.vx;
    if (f.state === 'hitstun' || f.state === 'blockstun') f.vx *= 0.82;
    f.x = Math.min(W - 18, Math.max(18, f.x));
  }

  // Keep the two bodies from overlapping
  function separate(a, b) {
    const gap = (a.def.build + b.def.build) * 0.9 * S;
    const dx = b.x - a.x;
    if (Math.abs(dx) < gap && Math.abs(a.y - b.y) < 30) {
      const push = (gap - Math.abs(dx)) / 2 * (Math.sign(dx) || 1);
      a.x -= push; b.x += push;
      a.x = Math.min(W - 14, Math.max(14, a.x));
      b.x = Math.min(W - 14, Math.max(14, b.x));
    }
  }

  const height = (f) => S * (f.crouch && grounded(f) && f.state !== 'attack' ? 32 : (f.state === 'down' || f.state === 'ko') ? 10 : 46);

  function landHit(att, def, m, x, y, chipMul = 1) {
    // Blocking: holding back on the ground, low attacks need a crouch, jump attacks need standing
    const canBlock = def.blocking && grounded(def) && !busy(def);
    const ok = canBlock && (m.lvl === 'mid' || (m.lvl === 'low' && def.crouch) || (m.lvl === 'high' && !def.crouch));
    if (ok) {
      def.hp = Math.max(1, def.hp - Math.ceil(m.dmg * 0.12 * chipMul));
      def.state = 'blockstun'; def.stun = 10; def.vx = -def.face * m.kb * 0.8;
      hitstop = 4;
      burst(x, y, '--fx-steel', 5);
      sfx('block');
      return;
    }
    def.hp = Math.max(0, def.hp - m.dmg * def.def.armour);
    hitstop = m.snd === 'heavy' ? 7 : 5;
    shake = m.snd === 'heavy' ? 4 : 2;
    burst(x, y, '--amber', 10);
    sfx(m.snd || 'hit');
    def.move = null;
    if (def.hp <= 0) {
      def.state = 'ko'; def.vy = -3; def.vx = -def.face * 1.6;
      return;
    }
    if (!grounded(def) || m.kb >= 4) { def.state = 'fall'; def.vy = -2.6; def.vx = -def.face * 1.4; return; }
    def.state = 'hitstun'; def.stun = m.stun; def.vx = -def.face * m.kb;
  }

  function checkHit(att, def) {
    if (att.state !== 'attack' || att.hit) return;
    const m = att.move;
    if (!m || m.kind === 'flare') return;
    if (att.t < m.s || att.t >= m.s + m.a) return;
    if (def.state === 'down' || def.state === 'ko') return;
    const x0 = att.x + att.face * m.from * S, x1 = att.x + att.face * m.reach * S;
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    const ay0 = att.y + m.y[0] * S, ay1 = att.y + m.y[1] * S;
    const dy0 = def.y - height(def), dy1 = def.y;
    const w = def.def.build * S;
    if (hi < def.x - w || lo > def.x + w || ay1 < dy0 || ay0 > dy1) return;
    att.hit = true;
    landHit(att, def, m, def.x - att.face * 4, (Math.max(ay0, dy0) + Math.min(ay1, dy1)) / 2, att.moveKey === 'special' ? 2 : 1);
  }

  function updateShots() {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx;
      s.life--;
      const def = s.owner === p1 ? p2 : p1;
      const w = def.def.build * S;
      if (Math.abs(s.x - def.x) < w + 3 && s.y > def.y - height(def) && s.y < def.y && def.state !== 'down' && def.state !== 'ko') {
        landHit(s.owner, def, { dmg: s.dmg, lvl: 'mid', kb: 2.2, stun: 16, snd: 'heavy' }, s.x, s.y, 2);
        shots.splice(i, 1);
        continue;
      }
      if (s.life <= 0 || s.x < -10 || s.x > W + 10) shots.splice(i, 1);
    }
  }

  function burst(x, y, c, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, v = 0.6 + Math.random() * 1.8;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, life: 10 + Math.random() * 10, c });
    }
  }

  /* ---------- The CPU ---------- */

  function brain(me, foe) {
    const inp = { left: false, right: false, up: false, down: false, punchP: false, kickP: false, specialP: false };
    const dist = Math.abs(foe.x - me.x);
    const fwdKey = me.face > 0 ? 'right' : 'left';
    const backKey = me.face > 0 ? 'left' : 'right';
    const threat = (foe.state === 'attack' && dist < 48) || shots.some((s) => s.owner === foe && Math.abs(s.x - me.x) < 60 && Math.sign(s.vx) === Math.sign(me.x - s.x));

    if (cpu.planT > 0 && cpu.plan) {
      cpu.planT--;
      Object.assign(inp, cpu.plan);
      return inp;
    }
    if (cpu.wait > 0) { cpu.wait--; return inp; }
    cpu.wait = 6 + Math.floor(Math.random() * 10);   // reaction time

    const r = Math.random();
    let plan = {};
    let hold = 8;
    if (threat && r < 0.55) {
      const flare = shots.some((s) => s.owner === foe);
      plan = flare && Math.random() < 0.4 ? { up: true, [fwdKey]: true } : { [backKey]: true, down: foe.moveKey === 'low' };
      hold = 18;
    } else if (dist > 90 && me.cool <= 0 && r < 0.35) {
      plan = { specialP: true };
      hold = 1;
    } else if (dist > 36) {
      plan = r < 0.12 ? { up: true, [fwdKey]: true } : { [fwdKey]: true };
      hold = 10 + Math.floor(Math.random() * 14);
    } else {
      if (r < 0.32) { plan = { punchP: true }; hold = 1; }
      else if (r < 0.52) { plan = { kickP: true }; hold = 1; }
      else if (r < 0.64) { plan = { down: true, kickP: true }; hold = 1; }
      else if (r < 0.72 && me.cool <= 0 && me.def.moves.special.kind === 'rush') { plan = { specialP: true }; hold = 1; }
      else if (r < 0.86) { plan = { [backKey]: true }; hold = 16; }
      else { plan = { [backKey]: true }; hold = 10; }
    }
    cpu.plan = plan;
    cpu.planT = hold;
    Object.assign(inp, plan);
    return inp;
  }

  /* ---------- Tick ---------- */

  function step() {
    sceneT++;
    if (scene === 'title') {
      if (take('start') || take('punch')) { scene = 'select'; sceneT = 0; sfx('blip'); }
      return;
    }
    if (scene === 'select') {
      if (take('left') || take('right')) { pick = 1 - pick; sfx('blip'); }
      if (take('start') || take('punch')) { startMatch(); }
      return;
    }
    if (scene === 'over') {
      if (sceneT > 60 && (take('start') || take('punch'))) { scene = 'select'; sceneT = 0; sfx('blip'); }
      return;
    }

    if (hitstop > 0) { hitstop--; return; }

    const human = {
      left: held.left, right: held.right, up: held.up, down: held.down,
      punchP: take('punch'), kickP: take('kick'), specialP: take('special'),
    };
    if (scene === 'fight') {
      control(p1, p2, human);
      control(p2, p1, brain(p2, p1));
      if (--clock <= 0) endRound(p1.hp === p2.hp ? null : p1.hp > p2.hp ? p1 : p2, 'TIME');
    } else {
      // Intro and round end: bodies settle, nobody acts
      [p1, p2].forEach((f) => { if (f.state === 'walk') f.state = 'idle'; });
      if (scene === 'intro') {
        if (sceneT === 70) { banner = 'FIGHT'; sfx('blip'); }
        if (sceneT > 100) { scene = 'fight'; banner = ''; }
      }
      if (scene === 'roundEnd' && sceneT > 150) {
        if (p1.wins >= 2 || p2.wins >= 2) {
          scene = 'over'; sceneT = 0;
          banner = p1.wins >= 2 ? 'YOU WIN' : 'YOU LOSE';
        } else { round++; startRound(); }
      }
    }
    [p1, p2].forEach(physics);
    separate(p1, p2);
    checkHit(p1, p2);
    checkHit(p2, p1);
    updateShots();
    if (scene === 'fight' && (p1.state === 'ko' || p2.state === 'ko')) {
      sfx('ko');
      endRound(p1.state === 'ko' ? p2 : p1, 'K.O.');
    }
    [p1, p2].forEach((f) => { f.shown += (f.hp - f.shown) * 0.06; });
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.08;
      if (--s.life <= 0) sparks.splice(i, 1);
    }
    if (shake > 0) shake -= 0.25;
  }

  function endRound(winner, why) {
    Object.keys(pressed).forEach((k) => { pressed[k] = false; });
    scene = 'roundEnd';
    sceneT = 0;
    banner = why;
    if (winner) {
      winner.wins++;
      if (winner.state !== 'ko') { winner.state = 'win'; winner.t = 0; }
    }
  }

  /* ---------- Drawing ---------- */

  // Background drawn once: a night dock with a planet, gantries and a neon sign
  let stage = null;
  function paintStage() {
    stage = document.createElement('canvas');
    stage.width = W; stage.height = H;
    const s = stage.getContext('2d');
    s.fillStyle = col('--space-black'); s.fillRect(0, 0, W, H);
    for (let k = 0; k < 90; k++) {
      s.fillStyle = k % 7 ? col('--ink-dim') : col('--cream');
      s.fillRect((k * 73) % W, (k * 37) % 110, 1, 1);
    }
    // The planet, half set behind the dock
    s.fillStyle = col('--earth-ocean');
    s.beginPath(); s.arc(250, 96, 46, 0, 6.283); s.fill();
    s.fillStyle = col('--earth-land');
    s.fillRect(222, 70, 22, 10); s.fillRect(236, 82, 30, 8); s.fillRect(258, 62, 14, 12);
    s.fillStyle = col('--space-black');
    s.globalAlpha = 0.45;
    s.beginPath(); s.arc(266, 92, 46, 0, 6.283); s.fill();
    s.globalAlpha = 1;
    // Gantries and the far dock
    s.fillStyle = col('--soot');
    s.fillRect(0, 104, W, 54);
    for (let x = 0; x < W; x += 46) { s.fillRect(x + 8, 58, 6, 50); s.fillRect(x, 58, 30, 4); }
    s.fillStyle = col('--rule');
    for (let x = 0; x < W; x += 12) s.fillRect(x, 104, 6, 2);
    s.fillRect(0, 120, W, 1);
    // Neon sign
    s.fillStyle = col('--bebop-red'); s.fillRect(24, 74, 64, 18);
    s.fillStyle = col('--space-black'); s.fillRect(26, 76, 60, 14);
    s.fillStyle = col('--amber'); s.font = '14px VT323, monospace'; s.fillText('DOCK 9', 34, 87);
    // Floor: plates and perspective lines
    s.fillStyle = col('--deck'); s.fillRect(0, 138, W, H - 138);
    s.strokeStyle = col('--deck-line'); s.lineWidth = 1;
    for (let k = -8; k <= 8; k++) { s.beginPath(); s.moveTo(W / 2 + k * 14, 138); s.lineTo(W / 2 + k * 46, H); s.stroke(); }
    [146, 157, 170].forEach((y) => { s.beginPath(); s.moveTo(0, y); s.lineTo(W, y); s.stroke(); });
    s.fillStyle = col('--amber');
    for (let x = 0; x < W; x += 20) s.fillRect(x, 138, 10, 2);
  }

  // A pose: angles for torso, both arms (shoulder, elbow) and legs (hip, knee).
  // 0 points straight down; positive swings forward.
  function pose(f, t) {
    const P = { lean: 0, drop: 0, fa: [0.6, 1.9], ba: [0.3, 2.2], fl: [0.25, -0.25], bl: [-0.25, 0.15], flat: false };
    const bob = Math.sin(t * 0.12) * 0.6;
    P.drop = bob;
    const m = f.move;
    const phase = m ? (f.t < m.s ? 0 : f.t < m.s + m.a ? 1 : 2) : 0;
    const crouchLegs = () => { P.drop = 12; P.fl = [1.35, -2.25]; P.bl = [0.9, -2.3]; };

    switch (f.state) {
      case 'walk': {
        const w = Math.sin(f.walkT);
        P.fl = [0.25 + w * 0.45, -0.3 - Math.max(0, w) * 0.4];
        P.bl = [-0.25 - w * 0.45, 0.1 - Math.max(0, -w) * 0.4];
        break;
      }
      case 'jump': P.fl = [1.0, -1.6]; P.bl = [0.35, -1.4]; P.drop = 0; break;
      case 'hitstun': case 'blockstun':
        if (f.state === 'hitstun') { P.lean = -0.35; P.fa = [-0.2, 0.8]; P.ba = [-0.4, 0.6]; }
        else { P.lean = -0.1; P.fa = [1.0, 2.0]; P.ba = [0.8, 2.2]; if (f.crouch) crouchLegs(); }
        break;
      case 'fall': case 'ko': case 'down':
        P.flat = true; break;
      case 'win': P.fa = [3.0, 0.1]; P.ba = [0.2, 0.4]; break;
      case 'attack': {
        const k = f.moveKey;
        const ext = phase === 1 ? 1 : phase === 0 ? Math.min(1, f.t / m.s) * 0.4 : Math.max(0, 1 - (f.t - m.s - m.a) / m.r);
        if (k === 'punch') { P.fa = [0.6 + 0.95 * ext, 1.9 * (1 - ext)]; P.lean = 0.12 * ext; }
        if (k === 'kick') { P.fl = [0.25 + 1.25 * ext, -0.25 * (1 - ext)]; P.lean = -0.28 * ext; P.bl = [-0.15, 0]; }
        if (k === 'low') { crouchLegs(); P.fl = [1.35 + 0.2 * ext, -2.25 * (1 - ext)]; P.lean = -0.1; }
        if (k === 'air') { P.fl = [0.6 + 0.6 * ext, -1.4 * (1 - ext)]; P.bl = [0.35, -1.4]; P.drop = 0; }
        if (k === 'special') {
          if (m.kind === 'flare') { P.fa = [0.6 + 0.95 * ext, 1.9 * (1 - ext)]; P.ba = [0.3 + 1.2 * ext, 2.2 * (1 - ext)]; }
          else { P.fa = [0.6 + 0.95 * ext, 1.9 * (1 - ext)]; P.lean = 0.3 * ext; P.bl = [-0.6 * ext, 0]; }
        }
        break;
      }
      default:
        if (f.crouch) crouchLegs();
        if (f.blocking && f.near) { P.fa = [1.0, 2.0]; P.ba = [0.8, 2.2]; P.lean = -0.08; }
    }
    return P;
  }

  function limb(x, y, a1, a2, l1, l2, c, w, endC, endW) {
    const jx = x + Math.sin(a1) * l1, jy = y + Math.cos(a1) * l1;
    const ex = jx + Math.sin(a1 + a2) * l2, ey = jy + Math.cos(a1 + a2) * l2;
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'square';
    g.beginPath(); g.moveTo(x, y); g.lineTo(jx, jy); g.lineTo(ex, ey); g.stroke();
    if (endC) { g.fillStyle = endC; g.fillRect(ex - endW / 2, ey - endW / 2, endW, endW); }
  }

  function drawFighter(f, t) {
    const L = f.def.look, P = pose(f, t);
    const big = f.def.build > 10;
    // Shadow on the floor
    g.fillStyle = col('--space-black'); g.globalAlpha = 0.4;
    g.fillRect(Math.round(f.x) - 16, FLOOR - 1, 32, 3);
    g.globalAlpha = 1;
    g.save();
    g.translate(Math.round(f.x), Math.round(f.y));
    g.scale(f.face * S, S);
    if (P.flat) { g.rotate(-1.45); g.translate(-8, 2); }
    const hipY = -21 + P.drop;
    const torso = big ? 19 : 18;
    const nx = Math.sin(P.lean) * torso, ny = hipY - Math.cos(P.lean) * torso;
    const legW = big ? 6 : 5;
    // Back limbs sit behind the body, a shade darker
    g.globalAlpha = 0.75;
    limb(-1, hipY, P.bl[0], P.bl[1], 11, 11, col(L.pants), legW, col('--fx-boot'), 5);
    limb(nx - 1, ny + 3, P.ba[0], P.ba[1], 9, 9, col(L.jacket), big ? 5 : 4, col(L.fist), 4);
    g.globalAlpha = 1;
    limb(1, hipY, P.fl[0], P.fl[1], 11, 11, col(L.pants), legW, col('--fx-boot'), 5);
    // Torso: jacket and belt
    g.strokeStyle = col(L.jacket); g.lineWidth = big ? 12 : 9; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(nx, ny); g.stroke();
    g.fillStyle = col(L.band); g.fillRect(-4, hipY - 2, 8, 2);
    // Head
    const hx = nx + Math.sin(P.lean) * 6, hy = ny - 6;
    g.fillStyle = col('--fx-skin'); g.fillRect(hx - 4, hy - 5, 8, 9);
    g.fillStyle = col(L.hair);
    if (big) { g.fillRect(hx - 5, hy - 7, 10, 3); g.fillRect(hx - 1, hy - 5, 6, 1); }   // flat cap
    else { g.fillRect(hx - 5, hy - 7, 9, 4); g.fillRect(hx - 6, hy - 6, 2, 3); g.fillRect(hx + 2, hy - 8, 2, 2); }
    g.fillStyle = col(L.band);
    if (!big) g.fillRect(hx - 4, hy - 3, 8, 1);   // headband
    g.fillStyle = col('--space-black'); g.fillRect(hx + 1, hy - 1, 2, 2);
    // Front arm last, over everything; Brass's is the piston
    limb(nx + 1, ny + 3, P.fa[0], P.fa[1], 9, 9, col(L.arm), big ? 6 : 4, col(L.fist), big ? 6 : 4);
    g.restore();
  }

  function text(s, x, y, size, c, align = 'center') {
    g.font = `${size}px VT323, monospace`;
    g.textAlign = align;
    g.fillStyle = col('--space-black');
    g.fillText(s, x + 1, y + 1);
    g.fillStyle = c;
    g.fillText(s, x, y);
  }

  function hud() {
    [p1, p2].forEach((f, k) => {
      const x = k ? W - 12 - 120 : 12;
      g.fillStyle = col('--space-black'); g.fillRect(x - 1, 9, 122, 9);
      g.fillStyle = col('--bebop-red');
      const lag = Math.max(0, f.shown) / 100 * 120;
      const now = Math.max(0, f.hp) / 100 * 120;
      g.fillRect(k ? x + 120 - lag : x, 10, lag, 7);
      g.fillStyle = col('--amber');
      g.fillRect(k ? x + 120 - now : x, 10, now, 7);
      text(f.def.name, k ? W - 12 : 12, 28, 12, col('--cream'), k ? 'right' : 'left');
      for (let w = 0; w < 2; w++) {
        g.fillStyle = w < f.wins ? col('--neon') : col('--rule');
        g.fillRect(k ? W - 12 - 120 - 10 - w * 7 : 12 + 120 + 4 + w * 7, 10, 5, 5);
      }
    });
    text(String(Math.max(0, Math.ceil(clock / 60))).padStart(2, '0'), W / 2, 22, 20, col('--cream'));
  }

  function render(t) {
    if (!stage) paintStage();
    g.save();
    if (shake > 0) g.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));
    g.drawImage(stage, 0, 0);

    if (scene === 'title' || scene === 'select') {
      const demoA = makeFighter(ROSTER[0], 120, 1), demoB = makeFighter(ROSTER[1], 200, -1);
      if (scene === 'select') { demoA.x = 90; demoB.x = 230; }
      drawFighter(demoA, t / 16);
      drawFighter(demoB, t / 16 + 7);
      g.restore();
      g.fillStyle = col('--space-black'); g.globalAlpha = 0.55; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      if (scene === 'title') {
        g.font = 'bold 22px Syncopate, sans-serif'; g.textAlign = 'center';
        g.fillStyle = col('--bebop-red'); g.fillText('DOCK 9', W / 2 + 1, 62);
        g.fillStyle = col('--cream'); g.fillText('DOCK 9', W / 2, 61);
        g.fillStyle = col('--bebop-red'); g.fillText('BRAWL', W / 2 + 1, 88);
        g.fillStyle = col('--amber'); g.fillText('BRAWL', W / 2, 87);
        if (Math.floor(t / 500) % 2) text('PRESS START', W / 2, 124, 16, col('--cream'));
        text('1 PLAYER VS CPU   BEST OF 3', W / 2, 150, 11, col('--ink-dim'));
      } else {
        text('CHOOSE YOUR FIGHTER', W / 2, 26, 16, col('--cream'));
        ROSTER.forEach((d, k) => {
          const x = k ? 230 : 90;
          g.strokeStyle = col(k === pick ? '--amber' : '--rule'); g.lineWidth = k === pick ? 2 : 1;
          g.strokeRect(x - 48, 38, 96, 128);
          text(d.name, x, 152, 14, col(k === pick ? '--amber' : '--cream'));
          text(k ? 'HEAVY / PISTON RUSH' : 'FAST / FLARE SHOT', x, 162, 10, col('--ink-dim'));
        });
        // Fighters drawn over the frames again so they're not dimmed
        drawFighter(Object.assign(makeFighter(ROSTER[0], 90, 1), { state: pick === 0 ? 'win' : 'idle' }), t / 16);
        drawFighter(Object.assign(makeFighter(ROSTER[1], 230, -1), { state: pick === 1 ? 'win' : 'idle' }), t / 16 + 7);
        text('< >  PICK     PUNCH / START  CONFIRM', W / 2, 176, 10, col('--ink-dim'));
      }
      return;
    }

    // Whoever is closer to the camera (lower on screen, or attacking) draws last
    const order = p1.state === 'attack' ? [p2, p1] : [p1, p2];
    [p1, p2].forEach((f) => { const foe = f === p1 ? p2 : p1; f.near = foe.state === 'attack' || shots.some((s) => s.owner === foe); });
    order.forEach((f) => drawFighter(f, sceneT));
    shots.forEach((s) => {
      g.fillStyle = col('--amber'); g.fillRect(s.x - 5, s.y - 3, 10, 6);
      g.fillStyle = col('--cream'); g.fillRect(s.x - 3, s.y - 2, 6, 4);
      g.fillStyle = col('--bebop-red'); g.fillRect(s.x - Math.sign(s.vx) * 10, s.y - 1, 5, 2);
    });
    sparks.forEach((p) => { g.fillStyle = col(p.c); g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
    g.restore();
    hud();
    if (banner) {
      const big = banner.length < 8;
      g.font = `bold ${big ? 22 : 18}px Syncopate, sans-serif`; g.textAlign = 'center';
      g.fillStyle = col('--bebop-red'); g.fillText(banner, W / 2 + 2, 92);
      g.fillStyle = col(banner === 'YOU LOSE' ? '--cream' : '--amber'); g.fillText(banner, W / 2, 90);
      if (scene === 'over' && sceneT > 60 && Math.floor(t / 500) % 2) text('PRESS START', W / 2, 118, 14, col('--cream'));
    }
  }

  /* ---------- Loop ---------- */

  let raf = 0, last = 0, acc = 0, running = false;
  const loop = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    acc += Math.min(100, now - (last || now));
    last = now;
    while (acc >= 1000 / 60) {
      try { step(); } catch (err) { console.error(err); }
      acc -= 1000 / 60;
    }
    render(now);
  };

  return {
    canvas,
    open() {
      if (running) return;
      running = true;
      scene = 'title'; sceneT = 0;
      last = 0; acc = 0;
      Object.keys(held).forEach((k) => { held[k] = false; pressed[k] = false; });
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      raf = requestAnimationFrame(loop);
    },
    close() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    },
    // Touch controls and buttons drive the same input as the keyboard
    press,
    // The idle cabinet screen: title card with the two fighters
    attract(t) { if (!running) { scene = 'title'; render(t); } },
    get running() { return running; },
  };
}
