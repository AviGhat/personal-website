/* ==========================================================
   Road Fighter: the lounge arcade cabinet's fighting game.
   An original brawler drawn in code at 320x180, with three
   fighters, motion-input specials, cancels, dashes, combos and
   a super each (two quarter circles, paid for with meter):
     Vesper  (ninja: shuriken, vanish)
     Rio Vega (Wing Chun: chain punch, sticky-hands parry)
     Ben     (karate: sun bolt, cyclone kick)
   One player against the CPU, best of three rounds.
   ========================================================== */

const W = 320, H = 180, FLOOR = 158;
const GRAVITY = 0.22;
const ROUND_TIME = 60;
const S = 1.4;   // fighters are drawn and measured at this scale

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
const sfx = (kind) => { try { if (window.agSound && window.agSound.fx) window.agSound.fx(kind); } catch (e) { /* ignore */ } };

/* ---------- Motion inputs ----------
   Directions in numpad notation, relative to the way the fighter faces:
   7 8 9 / 4 5 6 / 1 2 3, so 6 is forward and 4 is back.
   Quarter circle forward (QCF) is down, down-forward, forward; quarter
   circle back (QCB) is down, down-back, back. The diagonal is optional,
   since on a keyboard it's easy to miss. */
const MOTIONS = {
  qcf: { seqs: [[2, 3, 6], [2, 6]], label: '↓↘→' },
  qcb: { seqs: [[2, 1, 4], [2, 4]], label: '↓↙←' },
  // Two quarter circles forward; the diagonals are skipped over, so only the
  // down-forward-down-forward order matters
  qcf2: { seqs: [[2, 6, 2, 6]], label: '↓↘→↓↘→', window: 40 },
};
const MOTION_WINDOW = 20;   // ticks from the first direction to the button
const MOTION_LATE = 9;      // the last direction must be this fresh
const DASH_WINDOW = 12;     // forward, neutral, forward within this many ticks is a dash
const METER_MAX = 100;      // a super spends a full bar

/* ---------- The roster ---------- */

const ROSTER = [
  {
    id: 'vesper', name: 'VESPER', role: 'NINJA',
    walk: 1.45, jump: 5.0, armour: 1.1, build: 8,
    look: { top: '--fx-ninja', pants: '--fx-ninja-dark', sleeve: '--fx-ninja', arm: '--fx-ninja', fist: '--fx-ninja-dark', feet: '--fx-ninja-dark', head: 'hood', hood: '--fx-ninja-dark', tails: '--bebop-red', belt: '--bebop-red' },
    moves: {
      punch: { s: 3, a: 3, r: 8, dmg: 4, from: 6, reach: 22, y: [-40, -30], lvl: 'mid', kb: 1.4, stun: 12, snd: 'hit' },
      kick: { s: 5, a: 4, r: 11, dmg: 7, from: 4, reach: 30, y: [-30, -16], lvl: 'mid', kb: 2.4, stun: 15, snd: 'heavy' },
      low: { s: 5, a: 4, r: 13, dmg: 5, from: 4, reach: 30, y: [-8, 0], lvl: 'low', kb: 1.6, stun: 14, snd: 'hit' },
      air: { s: 3, a: 10, r: 4, dmg: 6, from: 2, reach: 24, y: [-26, -6], lvl: 'high', kb: 2, stun: 14, snd: 'hit' },
    },
    specials: [
      { motion: 'qcf', btn: 'punch', kind: 'shot', name: 'SHURIKEN', s: 8, a: 1, r: 14, shot: { v: 3.6, dmg: 6, look: 'star' } },
      { motion: 'qcb', btn: 'punch', kind: 'vanish', name: 'VANISH', s: 4, a: 14, r: 10 },
    ],
    // A fan of five shuriken in quick succession
    super: { motion: 'qcf2', btn: 'punch', kind: 'volley', name: 'NIGHT STORM', s: 6, a: 26, r: 16, count: 5, every: 5, shot: { v: 3.8, dmg: 5, look: 'star' } },
  },
  {
    id: 'rio', name: 'RIO VEGA', role: 'WING CHUN',
    walk: 1.3, jump: 4.6, armour: 1, build: 9,
    look: { top: '--teal', pants: '--soot', sleeve: '--teal', arm: '--teal', fist: '--fx-skin', feet: '--fx-boot', head: 'short', hair: '--fx-hair', collar: '--cream', belt: '--cream' },
    moves: {
      punch: { s: 3, a: 3, r: 7, dmg: 5, from: 6, reach: 23, y: [-42, -30], lvl: 'mid', kb: 1.4, stun: 13, snd: 'hit' },
      kick: { s: 6, a: 4, r: 12, dmg: 8, from: 4, reach: 29, y: [-30, -16], lvl: 'mid', kb: 2.6, stun: 16, snd: 'heavy' },
      low: { s: 5, a: 4, r: 13, dmg: 6, from: 4, reach: 30, y: [-8, 0], lvl: 'low', kb: 1.8, stun: 15, snd: 'hit' },
      air: { s: 4, a: 10, r: 4, dmg: 7, from: 2, reach: 25, y: [-26, -6], lvl: 'high', kb: 2, stun: 15, snd: 'hit' },
      // The strike Rio answers with when the parry catches something
      counter: { s: 2, a: 4, r: 14, dmg: 12, from: 4, reach: 30, y: [-44, -22], lvl: 'mid', kb: 4.2, stun: 20, snd: 'heavy' },
    },
    specials: [
      { motion: 'qcf', btn: 'punch', kind: 'chain', name: 'CHAIN PUNCH', s: 5, a: 20, r: 14, every: 4, drive: 1.1, dmg: 2.4, from: 6, reach: 26, y: [-44, -28], lvl: 'mid', kb: 0.6, stun: 12, snd: 'hit' },
      { motion: 'qcb', btn: 'punch', kind: 'parry', name: 'STICKY HANDS', s: 2, a: 22, r: 12 },
    ],
    // A long straight blast that ends in a knockdown palm
    super: { motion: 'qcf2', btn: 'punch', kind: 'chain', name: 'STRAIGHT BLAST', s: 4, a: 36, r: 18, every: 3, drive: 1.4, dmg: 2, from: 6, reach: 28, y: [-44, -26], lvl: 'mid', kb: 0.4, stun: 10, snd: 'hit', finish: { dmg: 10, kb: 4.6, stun: 24, snd: 'heavy' } },
  },
  {
    id: 'ben', name: 'BEN', role: 'KARATE',
    walk: 1.15, jump: 4.5, armour: 0.95, build: 10,
    look: { top: '--bebop-red', pants: '--bebop-red', sleeve: '--bebop-red', arm: '--fx-skin', fist: '--fx-skin', feet: '--fx-skin', head: 'tied', hair: '--fx-hair', band: '--amber', tails: '--amber', belt: '--space-black', lapel: '--fx-gi-shade' },
    moves: {
      punch: { s: 4, a: 3, r: 9, dmg: 6, from: 6, reach: 25, y: [-40, -30], lvl: 'mid', kb: 1.8, stun: 13, snd: 'hit' },
      kick: { s: 7, a: 4, r: 13, dmg: 9, from: 4, reach: 32, y: [-30, -16], lvl: 'mid', kb: 2.8, stun: 16, snd: 'heavy' },
      low: { s: 6, a: 4, r: 14, dmg: 7, from: 4, reach: 32, y: [-8, 0], lvl: 'low', kb: 2, stun: 15, snd: 'hit' },
      air: { s: 4, a: 10, r: 4, dmg: 8, from: 2, reach: 25, y: [-26, -6], lvl: 'high', kb: 2.2, stun: 15, snd: 'heavy' },
    },
    specials: [
      { motion: 'qcf', btn: 'punch', kind: 'shot', name: 'SUN BOLT', s: 11, a: 1, r: 20, shot: { v: 2.6, dmg: 10, look: 'fire' } },
      { motion: 'qcb', btn: 'kick', kind: 'spin', name: 'CYCLONE KICK', s: 6, a: 24, r: 14, every: 8, drive: 2.0, dmg: 4.5, from: -14, reach: 30, y: [-38, -18], lvl: 'mid', kb: 2.4, stun: 16, snd: 'heavy' },
    ],
    // A huge, slow sun bolt that hits five times
    super: { motion: 'qcf2', btn: 'punch', kind: 'shot', name: 'SOLAR FLARE', s: 10, a: 1, r: 26, shot: { v: 2.1, dmg: 5, look: 'fire', size: 2.4, hits: 5 } },
  },
];

/* ---------- Fighters ---------- */

function makeFighter(def, x, face) {
  return {
    def, x, y: FLOOR, vx: 0, vy: 0, face, hp: 100, shown: 100,
    state: 'idle', t: 0, move: null, moveKey: '', hit: false,
    stun: 0, walkT: 0, crouch: false, blocking: false, wins: 0,
    hidden: false, parry: false, airUsed: false, hist: [], lastDir: 5,
    meter: 0, combo: 0, comboShow: 0, connected: false, invuln: false, dash: 0,
  };
}

const grounded = (f) => f.y >= FLOOR;
const busy = (f) => ['attack', 'dash', 'hitstun', 'blockstun', 'fall', 'down', 'ko', 'win'].includes(f.state);
const NORMALS = ['punch', 'kick', 'low'];

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
  let tick = 0;
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
  let freeze = 0, freezeBy = null;   // super flash: the whole game holds while the super announces itself

  const startMatch = () => {
    const rest = ROSTER.filter((_, k) => k !== pick);
    p1 = makeFighter(ROSTER[pick], 90, 1);
    p2 = makeFighter(rest[Math.floor(Math.random() * rest.length)], 230, -1);
    round = 1;
    startRound();
  };
  const startRound = () => {
    [p1, p2].forEach((f, k) => {
      Object.assign(f, {
        x: k ? 230 : 90, y: FLOOR, vx: 0, vy: 0, face: k ? -1 : 1, hp: 100, shown: 100, state: 'idle', t: 0, move: null,
        stun: 0, crouch: false, blocking: false, hidden: false, parry: false, hist: [], lastDir: 5,
        combo: 0, comboShow: 0, connected: false, invuln: false, dash: 0,   // the super meter carries over between rounds
      });
    });
    shots.length = 0;
    sparks.length = 0;
    clock = ROUND_TIME * 60;
    scene = 'intro';
    sceneT = 0;
    banner = `ROUND ${round}`;
    sfx('blip');
  };

  /* ---------- Motion reading ---------- */

  function record(f, inp) {
    const fwd = f.face > 0 ? inp.right : inp.left;
    const back = f.face > 0 ? inp.left : inp.right;
    const h = fwd ? 1 : back ? -1 : 0;
    const v = inp.up ? 1 : inp.down ? -1 : 0;
    const d = 5 + h + v * 3;   // numpad: 2 is down, 6 forward, 4 back
    if (d !== f.lastDir) {
      f.lastDir = d;
      f.hist.push({ d, t: tick });
      if (f.hist.length > 24) f.hist.shift();
    }
  }
  function did(f, motion) {
    const win = MOTIONS[motion].window || MOTION_WINDOW;
    return MOTIONS[motion].seqs.some((seq) => {
      let i = 0;
      for (const e of f.hist) {
        if (tick - e.t > win) continue;
        if (e.d === seq[i]) i++;
        if (i === seq.length) return tick - e.t <= MOTION_LATE;
      }
      return false;
    });
  }

  /* ---------- One fighter's tick ---------- */

  function control(f, foe, inp) {
    const toward = Math.sign(foe.x - f.x) || f.face;
    if (grounded(f) && !busy(f)) f.face = toward;
    record(f, inp);
    const back = f.face > 0 ? inp.left : inp.right;
    const fwd = f.face > 0 ? inp.right : inp.left;
    f.blocking = false;

    if (f.state === 'attack') {
      // Cancels: a normal that connected can go straight into a special or super,
      // and a special that connected can go into the super
      const sp = wantSpecial(f, inp, back);
      if (sp && canCancel(f, sp)) { special(f, sp); return; }
      runMove(f, foe);
      return;
    }
    if (f.state === 'dash') {
      f.t++;
      f.invuln = f.dash < 0 && f.t < 7;   // a backdash slips through the first few frames
      f.vx *= 0.9;
      if (f.t >= (f.dash > 0 ? 14 : 16)) { f.state = 'idle'; f.vx = 0; f.invuln = false; }
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

    const sp = wantSpecial(f, inp, back);
    if (sp) { special(f, sp); return; }

    // Double-tap forward or back to dash
    const dash = inp.dash || dashed(f);
    if (dash) {
      f.state = 'dash'; f.dash = dash; f.t = 0;
      f.vx = (dash > 0 ? 3.4 : -3.0) * f.face;
      sfx('whiff');
      return;
    }

    f.crouch = inp.down;
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

  // The special (or super) these inputs ask for: a motion plus its button, or the
  // shortcut (SP / L; hold back for the second special, down for the super)
  function wantSpecial(f, inp, back) {
    const sup = f.def.super;
    const full = f.meter >= METER_MAX;
    const btn = (m) => (m.btn === 'punch' ? inp.punchP : inp.kickP);
    let sp = null;
    if (inp.spec === 'super') sp = full ? sup : null;
    else if (inp.spec != null) sp = f.def.specials[inp.spec];
    else if (inp.specialP) sp = inp.down && full ? sup : f.def.specials[back ? 1 : 0];
    else if (full && btn(sup) && did(f, sup.motion)) sp = sup;
    else sp = f.def.specials.find((cand) => btn(cand) && did(f, cand.motion)) || null;
    if (sp && sp !== sup && sp.kind === 'shot' && shots.some((s) => s.owner === f)) sp = null;   // one projectile at a time
    return sp;
  }
  function canCancel(f, sp) {
    const m = f.move;
    if (!f.connected || !m) return false;
    if (NORMALS.includes(f.moveKey)) return f.t < m.s + m.a + 10;
    return f.moveKey === 'special' && sp === f.def.super && m !== sp;
  }
  // Forward, neutral, forward (or back, neutral, back) in quick succession
  function dashed(f) {
    const h = f.hist, n = h.length;
    if (n < 3 || h[n - 1].t !== tick || h[n - 2].d !== 5 || tick - h[n - 3].t > DASH_WINDOW) return 0;
    // The first tap rolling out of a diagonal is the end of a quarter circle, not a dash
    if (n >= 4 && (h[n - 4].d === 3 || h[n - 4].d === 1) && h[n - 3].t - h[n - 4].t < 6) return 0;
    if (h[n - 1].d === 6 && h[n - 3].d === 6) return 1;
    if (h[n - 1].d === 4 && h[n - 3].d === 4) return -1;
    return 0;
  }

  function attack(f, key) {
    f.state = 'attack';
    f.moveKey = key;
    f.move = f.def.moves[key];
    f.t = 0;
    f.hit = false;
    f.connected = false;
    f.crouch = key === 'low';
    if (key !== 'air') f.vx = 0;
  }
  function special(f, sp) {
    f.state = 'attack';
    f.moveKey = 'special';
    f.move = sp;
    f.t = 0;
    f.hit = false;
    f.connected = false;
    f.crouch = false;
    f.vx = 0;
    f.hist.length = 0;   // a motion fires once
    f.meter = Math.min(METER_MAX, f.meter + 3);
    if (sp === f.def.super) {
      f.meter = 0;
      freeze = 46; freezeBy = f;
      sfx('super');
    }
  }

  // Advance a move one tick, with each special's own behaviour
  function runMove(f, foe) {
    f.t++;
    const m = f.move;
    const live = f.t >= m.s && f.t < m.s + m.a;
    if (f.moveKey === 'special') {
      if (m.kind === 'shot' && f.t === m.s) {
        shots.push({ owner: f, x: f.x + f.face * 16 * S, y: f.y - 32 * S, vx: m.shot.v * f.face, life: 220, dmg: m.shot.dmg, look: m.shot.look, spin: 0, hits: m.shot.hits || 1, size: m.shot.size || 1, cool: 0 });
        sfx('whiff');
      }
      if (m.kind === 'volley' && f.t >= m.s && (f.t - m.s) % m.every === 0 && (f.t - m.s) / m.every < m.count) {
        const k = (f.t - m.s) / m.every;
        shots.push({ owner: f, x: f.x + f.face * 16 * S, y: f.y - [32, 26, 38, 22, 30][k] * S, vx: m.shot.v * f.face, life: 160, dmg: m.shot.dmg, look: m.shot.look, spin: k, hits: 1, size: 1, cool: 0 });
        sfx('whiff');
      }
      if (m.kind === 'chain' || m.kind === 'spin') {
        f.vx = live ? m.drive * f.face : 0;
        if (live && (f.t - m.s) % m.every === 0) { f.hit = false; sfx('whiff'); }
      }
      if (m.kind === 'parry') f.parry = live;
      if (m.kind === 'vanish') {
        if (f.t === m.s) { f.hidden = true; smoke(f.x, f.y - 24 * S); sfx('whiff'); }
        if (f.t === m.s + m.a) {
          // Reappear behind the opponent, or as close as the walls allow
          f.x = Math.min(W - 18, Math.max(18, foe.x - foe.face * 26 * S));
          f.face = Math.sign(foe.x - f.x) || -foe.face;
          f.hidden = false;
          smoke(f.x, f.y - 24 * S);
        }
      }
    } else if (f.t === m.s) sfx('whiff');
    if (f.t >= m.s + m.a + m.r && (grounded(f) || f.moveKey !== 'air')) {
      f.state = 'idle'; f.move = null; f.vx = 0; f.parry = false; f.hidden = false;
    }
  }

  function physics(f) {
    if (!grounded(f) || f.vy < 0) {
      f.vy += GRAVITY;
      f.y += f.vy;
      if (f.y >= FLOOR) {
        f.y = FLOOR;
        f.vy = 0;
        if (f.state === 'fall') { f.state = 'down'; f.stun = 26; }
        else if (f.state === 'jump' || (f.state === 'attack' && f.moveKey === 'air')) { f.state = 'idle'; f.move = null; }
        f.vx = 0;
      }
    }
    f.x += f.vx;
    if (f.state === 'hitstun' || f.state === 'blockstun') f.vx *= 0.82;
    f.x = Math.min(W - 18, Math.max(18, f.x));
  }

  // Keep the two bodies from overlapping (a vanished ninja passes through)
  function separate(a, b) {
    if (a.hidden || b.hidden) return;
    const gap = (a.def.build + b.def.build) * 0.9 * S;
    const dx = b.x - a.x;
    if (Math.abs(dx) < gap && Math.abs(a.y - b.y) < 30) {
      const push = (gap - Math.abs(dx)) / 2 * (Math.sign(dx) || 1);
      a.x -= push; b.x += push;
      a.x = Math.min(W - 14, Math.max(14, a.x));
      b.x = Math.min(W - 14, Math.max(14, b.x));
    }
  }

  const height = (f) => S * (f.crouch && grounded(f) && f.moveKey !== 'special' ? 32 : (f.state === 'down' || f.state === 'ko') ? 10 : 46);

  function landHit(att, def, m, x, y, chipMul = 1, fromShot = false) {
    // Sticky hands: Rio's parry eats the hit and answers with a palm strike
    if (def.parry) {
      def.parry = false;
      def.face = Math.sign((fromShot ? x : att.x) - def.x) || def.face;
      attack(def, 'counter');
      hitstop = 8;
      burst(x, y, '--cream', 8);
      sfx('block');
      if (!fromShot) { att.state = 'hitstun'; att.stun = 18; att.vx = 0; att.move = null; }
      return;
    }
    // Blocking: holding back on the ground, low attacks need a crouch, jump attacks need standing
    const canBlock = def.blocking && grounded(def) && !busy(def);
    const ok = canBlock && (m.lvl === 'mid' || (m.lvl === 'low' && def.crouch) || (m.lvl === 'high' && !def.crouch));
    if (!fromShot) att.connected = true;
    if (ok) {
      att.meter = Math.min(METER_MAX, att.meter + 3);
      def.hp = Math.max(1, def.hp - Math.ceil(m.dmg * 0.12 * chipMul));
      def.state = 'blockstun'; def.stun = 10; def.vx = -def.face * m.kb * 0.8;
      hitstop = 4;
      burst(x, y, '--fx-steel', 5);
      sfx('block');
      return;
    }
    // A hit while the defender is still reeling from the last one extends the combo;
    // each extra hit in a combo does a little less
    const reeling = def.state === 'hitstun' || def.state === 'fall';
    att.combo = reeling ? att.combo + 1 : 1;
    if (att.combo > 1) att.comboShow = 70;
    const scale = Math.max(0.4, 1 - 0.1 * (att.combo - 1));
    def.hp = Math.max(0, def.hp - m.dmg * scale * def.def.armour);
    att.meter = Math.min(METER_MAX, att.meter + 7);
    def.meter = Math.min(METER_MAX, def.meter + 4);
    hitstop = m.snd === 'heavy' ? 7 : 5;
    shake = m.snd === 'heavy' ? 4 : 2;
    burst(x, y, '--amber', 10);
    sfx(m.snd || 'hit');
    def.move = null; def.parry = false; def.hidden = false;
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
    if (!m || m.reach == null) return;   // shots, vanish and parry hit some other way
    if (att.t < m.s || att.t >= m.s + m.a) return;
    if (def.hidden || def.invuln || def.state === 'down' || def.state === 'ko') return;
    const x0 = att.x + att.face * m.from * S, x1 = att.x + att.face * m.reach * S;
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    const ay0 = att.y + m.y[0] * S, ay1 = att.y + m.y[1] * S;
    const dy0 = def.y - height(def), dy1 = def.y;
    const w = def.def.build * S;
    if (hi < def.x - w || lo > def.x + w || ay1 < dy0 || ay0 > dy1) return;
    att.hit = true;
    // The last hit of a multi-hit move can be a finisher
    const last = m.finish && att.t >= m.s + m.a - m.every;
    landHit(att, def, last ? { ...m, ...m.finish } : m, def.x - att.face * 4, (Math.max(ay0, dy0) + Math.min(ay1, dy1)) / 2, att.moveKey === 'special' ? 2 : 1);
  }

  function updateShots() {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx;
      s.spin += 0.5;
      s.life--;
      if (s.cool > 0) { s.cool--; continue; }
      const r = 6 * s.size;
      // Projectiles meeting trade hits: small ones cancel, a super eats them one hit at a time
      const other = shots.find((o) => o !== s && o.owner !== s.owner && !o.cool && Math.abs(o.x - s.x) < 4 + r + 6 * o.size && Math.abs(o.y - s.y) < 8 + r);
      if (other) {
        burst((s.x + other.x) / 2, s.y, '--cream', 10);
        sfx('block');
        [s, other].forEach((o) => { o.hits--; o.cool = 8; });
        [s, other].forEach((o) => { if (o.hits <= 0) shots.splice(shots.indexOf(o), 1); });
        i = shots.length;
        continue;
      }
      const def = s.owner === p1 ? p2 : p1;
      const w = def.def.build * S;
      if (!def.hidden && !def.invuln && Math.abs(s.x - def.x) < w + r && s.y + r > def.y - height(def) && s.y - r < def.y && def.state !== 'down' && def.state !== 'ko') {
        landHit(s.owner, def, { dmg: s.dmg, lvl: 'mid', kb: s.hits > 1 ? 0.8 : 2.2, stun: 16, snd: 'heavy' }, s.x, s.y, 2, true);
        if (--s.hits <= 0) shots.splice(i, 1);
        else { s.cool = 7; s.x -= s.vx * 3; }   // hold on the target for the next hit
        continue;
      }
      if (s.life <= 0 || s.x < -10 || s.x > W + 10) shots.splice(i, 1);
    }
  }

  function burst(x, y, c, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, v = 0.6 + Math.random() * 1.8;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, life: 10 + Math.random() * 10, c, size: 2 });
    }
  }
  function smoke(x, y) {
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * 6.283, v = 0.3 + Math.random() * 1.1;
      sparks.push({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 40, vx: Math.cos(a) * v, vy: -0.3 - Math.random() * 0.5, life: 18 + Math.random() * 14, c: k % 3 ? '--ink-dim' : '--fx-ninja', size: 4 });
    }
  }

  /* ---------- The CPU ---------- */

  function brain(me, foe) {
    const inp = { left: false, right: false, up: false, down: false, punchP: false, kickP: false, specialP: false, spec: null };
    const dist = Math.abs(foe.x - me.x);
    const fwdKey = me.face > 0 ? 'right' : 'left';
    const backKey = me.face > 0 ? 'left' : 'right';
    const incoming = shots.some((s) => s.owner === foe && Math.abs(s.x - me.x) < 70 && Math.sign(s.vx) === Math.sign(me.x - s.x));
    const threat = (foe.state === 'attack' && dist < 52) || incoming;
    const kinds = me.def.specials.map((sp) => sp.kind);
    const has = (kind) => kinds.indexOf(kind);
    const myShot = shots.some((s) => s.owner === me);

    // Confirm a landed normal into a special now and then
    if (me.state === 'attack' && me.connected && NORMALS.includes(me.moveKey) && Math.random() < 0.08) {
      return Object.assign(inp, me.meter >= METER_MAX && Math.random() < 0.5 ? { spec: 'super' } : { spec: has('shot') >= 0 ? has('shot') : 0 });
    }
    if (cpu.planT > 0 && cpu.plan) {
      cpu.planT--;
      Object.assign(inp, cpu.plan);
      if (cpu.plan.spec != null) cpu.plan.spec = null;   // a special or dash is a single press
      cpu.plan.dash = 0;
      return inp;
    }
    if (cpu.wait > 0) { cpu.wait--; return inp; }
    cpu.wait = 6 + Math.floor(Math.random() * 10);   // reaction time

    const r = Math.random();
    let plan = {};
    let hold = 8;
    const full = me.meter >= METER_MAX;
    const superKind = me.def.super.kind;
    if (full && r < 0.3 && (superKind === 'chain' ? dist < 70 : dist > 60)) {
      plan = { spec: 'super' }; hold = 1;
    } else if (threat && dist < 40 && r < 0.1) {
      plan = { dash: -1 }; hold = 1;
    } else if (threat && r < 0.6) {
      if (has('parry') >= 0 && r < 0.3) { plan = { spec: has('parry') }; hold = 1; }
      else if (has('vanish') >= 0 && incoming && r < 0.35) { plan = { spec: has('vanish') }; hold = 1; }
      else if (incoming && r < 0.2) { plan = { up: true, [fwdKey]: true }; hold = 18; }
      else { plan = { [backKey]: true, down: foe.moveKey === 'low' }; hold = 18; }
    } else if (dist > 90 && has('shot') >= 0 && !myShot && r < 0.4) {
      plan = { spec: has('shot') }; hold = 1;
    } else if (dist > 80 && has('vanish') >= 0 && r < 0.12) {
      plan = { spec: has('vanish') }; hold = 1;
    } else if (dist > 120 && r < 0.18) {
      plan = { dash: 1 }; hold = 1;
    } else if (dist > 38) {
      if (has('spin') >= 0 && dist < 80 && r < 0.12) { plan = { spec: has('spin') }; hold = 1; }
      else if (has('chain') >= 0 && dist < 64 && r < 0.14) { plan = { spec: has('chain') }; hold = 1; }
      else { plan = r < 0.12 ? { up: true, [fwdKey]: true } : { [fwdKey]: true }; hold = 10 + Math.floor(Math.random() * 14); }
    } else {
      if (r < 0.3) { plan = { punchP: true }; hold = 1; }
      else if (r < 0.48) { plan = { kickP: true }; hold = 1; }
      else if (r < 0.6) { plan = { down: true, kickP: true }; hold = 1; }
      else if (r < 0.7) { plan = { spec: has('chain') >= 0 ? has('chain') : has('spin') >= 0 ? has('spin') : 0 }; hold = 1; }
      else { plan = { [backKey]: true }; hold = 12 + Math.floor(Math.random() * 8); }
    }
    cpu.plan = plan;
    cpu.planT = hold;
    Object.assign(inp, plan);
    return inp;
  }

  /* ---------- Tick ---------- */

  function step() {
    sceneT++;
    tick++;
    if (scene === 'title') {
      if (take('start') || take('punch')) { scene = 'select'; sceneT = 0; sfx('blip'); }
      return;
    }
    if (scene === 'select') {
      if (take('left')) { pick = (pick + ROSTER.length - 1) % ROSTER.length; sfx('blip'); }
      if (take('right')) { pick = (pick + 1) % ROSTER.length; sfx('blip'); }
      if (take('start') || take('punch')) { startMatch(); }
      return;
    }
    if (scene === 'over') {
      if (sceneT > 60 && (take('start') || take('punch'))) { scene = 'select'; sceneT = 0; sfx('blip'); }
      return;
    }

    if (freeze > 0 || hitstop > 0) {
      if (freeze > 0) freeze--; else hitstop--;
      if (scene === 'fight') record(p1, held);   // keep reading the stick, so motions can be buffered through a pause
      return;
    }

    const human = {
      left: held.left, right: held.right, up: held.up, down: held.down,
      punchP: take('punch'), kickP: take('kick'), specialP: take('special'), spec: null,
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
    [p1, p2].forEach((f) => { f.shown += (f.hp - f.shown) * 0.06; if (f.comboShow > 0) f.comboShow--; });
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vy += s.size > 2 ? 0 : 0.08;
      if (--s.life <= 0) sparks.splice(i, 1);
    }
    if (shake > 0) shake -= 0.25;
  }

  function endRound(winner, why) {
    Object.keys(pressed).forEach((k) => { pressed[k] = false; });
    scene = 'roundEnd';
    sceneT = 0;
    banner = why;
    [p1, p2].forEach((f) => { f.hidden = false; f.parry = false; });
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
    if (f.def.id === 'rio') { P.fa = [0.95, 1.1]; P.ba = [0.75, 1.35]; }   // Wing Chun guard: hands up the centre line
    P.drop = Math.sin(t * 0.12) * 0.6;
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
      case 'dash':
        if (f.dash > 0) { P.lean = 0.35; P.fl = [0.9, -0.6]; P.bl = [-0.7, 0.2]; P.ba = [-0.5, 0.8]; }
        else { P.lean = -0.25; P.fl = [0.6, -0.2]; P.bl = [-0.3, -0.5]; P.drop = 2; }
        break;
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
        if (k === 'punch' || k === 'counter') { P.fa = [0.6 + 0.95 * ext, 1.9 * (1 - ext)]; P.lean = (k === 'counter' ? 0.25 : 0.12) * ext; }
        if (k === 'kick') { P.fl = [0.25 + 1.25 * ext, -0.25 * (1 - ext)]; P.lean = -0.28 * ext; P.bl = [-0.15, 0]; }
        if (k === 'low') { crouchLegs(); P.fl = [1.35 + 0.2 * ext, -2.25 * (1 - ext)]; P.lean = -0.1; }
        if (k === 'air') { P.fl = [0.6 + 0.6 * ext, -1.4 * (1 - ext)]; P.bl = [0.35, -1.4]; P.drop = 0; }
        if (k === 'special') {
          if (m.kind === 'shot' && m.shot.look === 'fire') { P.fa = [0.6 + 0.95 * ext, 1.9 * (1 - ext)]; P.ba = [0.3 + 1.25 * ext, 2.2 * (1 - ext)]; P.lean = 0.1 * ext; P.fl = [0.5, -0.2]; P.bl = [-0.5, 0.1]; }
          if (m.kind === 'shot' && m.shot.look === 'star') { P.fa = phase === 0 ? [2.8, 0.3] : [1.5, 0]; P.lean = 0.15 * ext; }
          if (m.kind === 'volley') { const k = Math.floor((f.t - m.s) / m.every) % 2; P.fa = k ? [1.5, 0] : [2.6, 0.4]; P.ba = k ? [2.6, 0.4] : [1.5, 0]; P.lean = 0.12; }
          if (m.kind === 'chain') {
            const left = Math.floor(f.t / 2) % 2;
            P.fa = left ? [1.55, 0] : [1.0, 1.2];
            P.ba = left ? [0.9, 1.3] : [1.55, 0];
            P.lean = 0.12;
          }
          if (m.kind === 'parry') { P.fa = [1.25, 0.5]; P.ba = [1.0, 0.9]; P.lean = -0.05; }
          if (m.kind === 'vanish') crouchLegs();
          if (m.kind === 'spin') { P.fl = [1.55 * ext + 0.2, 0]; P.bl = [-0.2, 0.1]; P.fa = [1.6, 0]; P.ba = [-1.5, 0]; P.drop = -6 * ext; }
        }
        break;
      }
      default:
        if (f.crouch) crouchLegs();
        if (f.blocking && f.near) { P.fa = [1.0, 2.0]; P.ba = [0.8, 2.2]; P.lean = -0.08; }
    }
    return P;
  }

  // A two-part limb: upper in c1, lower in c2 (sleeve then bare forearm, say)
  function limb(x, y, a1, a2, l1, l2, c1, c2, w, endC, endW) {
    const jx = x + Math.sin(a1) * l1, jy = y + Math.cos(a1) * l1;
    const ex = jx + Math.sin(a1 + a2) * l2, ey = jy + Math.cos(a1 + a2) * l2;
    g.lineWidth = w; g.lineCap = 'square';
    g.strokeStyle = c1; g.beginPath(); g.moveTo(x, y); g.lineTo(jx, jy); g.stroke();
    g.strokeStyle = c2; g.beginPath(); g.moveTo(jx, jy); g.lineTo(ex, ey); g.stroke();
    if (endC) { g.fillStyle = endC; g.fillRect(ex - endW / 2, ey - endW / 2, endW, endW); }
  }

  function drawHead(L, hx, hy, t) {
    if (L.head === 'hood') {
      // Hood and mask: only a strip of face and the eyes show; scarf ends trail behind
      g.fillStyle = col(L.hood); g.fillRect(hx - 5, hy - 7, 10, 12);
      g.fillStyle = col('--fx-skin'); g.fillRect(hx - 2, hy - 3, 6, 3);
      g.fillStyle = col('--space-black'); g.fillRect(hx + 1, hy - 2, 2, 1);
      g.fillStyle = col(L.tails);
      g.fillRect(hx - 9, hy + 2 + Math.round(Math.sin(t * 0.2)), 5, 2);
      g.fillRect(hx - 12, hy + 3 + Math.round(Math.sin(t * 0.2 + 1)), 4, 2);
      return;
    }
    g.fillStyle = col('--fx-skin'); g.fillRect(hx - 4, hy - 5, 8, 9);
    g.fillStyle = col(L.hair);
    if (L.head === 'short') {
      g.fillRect(hx - 5, hy - 7, 9, 3); g.fillRect(hx - 5, hy - 5, 2, 3);
    } else {
      // Dark hair pulled back into a short tail
      g.fillRect(hx - 5, hy - 7, 9, 3); g.fillRect(hx - 5, hy - 5, 2, 2); g.fillRect(hx - 8, hy - 5, 3, 3);
    }
    if (L.band) {
      g.fillStyle = col(L.band); g.fillRect(hx - 5, hy - 4, 10, 2);
      // Headband ends fluttering behind
      g.fillRect(hx - 9, hy - 4 + Math.round(Math.sin(t * 0.25)), 4, 1);
      g.fillRect(hx - 11, hy - 3 + Math.round(Math.sin(t * 0.25 + 1.2)), 3, 1);
    }
    g.fillStyle = col('--space-black'); g.fillRect(hx + 1, hy - 1, 2, 2);
  }

  function drawFighter(f, t) {
    if (f.hidden) return;
    const L = f.def.look, P = pose(f, t);
    // Shadow on the floor
    g.fillStyle = col('--space-black'); g.globalAlpha = 0.4;
    g.fillRect(Math.round(f.x) - 16, FLOOR - 1, 32, 3);
    g.globalAlpha = 1;
    g.save();
    g.translate(Math.round(f.x), Math.round(f.y));
    // The cyclone kick spins: flip the drawing as it turns
    const spinning = f.moveKey === 'special' && f.move && f.move.kind === 'spin' && f.state === 'attack' && f.t >= f.move.s && f.t < f.move.s + f.move.a;
    g.scale(f.face * S * (spinning && Math.floor(f.t / 3) % 2 ? -1 : 1), S);
    if (P.flat) { g.rotate(-1.45); g.translate(-8, 2); }
    const hipY = -21 + P.drop;
    const torso = 18;
    const nx = Math.sin(P.lean) * torso, ny = hipY - Math.cos(P.lean) * torso;
    // Back limbs sit behind the body, a shade darker
    g.globalAlpha = 0.75;
    limb(-1, hipY, P.bl[0], P.bl[1], 11, 11, col(L.pants), col(L.pants), 5, col(L.feet), 5);
    limb(nx - 1, ny + 3, P.ba[0], P.ba[1], 9, 9, col(L.sleeve), col(L.arm), 4, col(L.fist), 4);
    g.globalAlpha = 1;
    limb(1, hipY, P.fl[0], P.fl[1], 11, 11, col(L.pants), col(L.pants), 5, col(L.feet), 5);
    // Torso, belt, and a collar or lapel
    g.strokeStyle = col(L.top); g.lineWidth = 9; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(nx, ny); g.stroke();
    g.fillStyle = col(L.belt); g.fillRect(-4, hipY - 2, 8, 2);
    if (L.collar) { g.fillStyle = col(L.collar); g.fillRect(nx - 1, ny, 3, 5); }
    if (L.lapel) { g.strokeStyle = col(L.lapel); g.lineWidth = 1; g.beginPath(); g.moveTo(nx - 3, ny + 1); g.lineTo(nx + 1, ny + 8); g.lineTo(nx + 4, ny + 1); g.stroke(); }
    drawHead(L, nx + Math.sin(P.lean) * 6, ny - 6, t);
    // Front arm last, over everything
    limb(nx + 1, ny + 3, P.fa[0], P.fa[1], 9, 9, col(L.sleeve), col(L.arm), 4, col(L.fist), 4);
    if (f.parry) { g.fillStyle = col('--cream'); g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.6); g.fillRect(nx + 10, ny - 4, 2, 14); g.globalAlpha = 1; }
    g.restore();
  }

  function drawShot(s) {
    const x = Math.round(s.x), y = Math.round(s.y);
    if (s.look === 'star') {
      // A four-point star, turning as it flies
      g.save(); g.translate(x, y); g.rotate(s.spin);
      g.fillStyle = col('--fx-steel'); g.fillRect(-5, -1, 10, 2); g.fillRect(-1, -5, 2, 10);
      g.fillStyle = col('--cream'); g.fillRect(-1, -1, 2, 2);
      g.restore();
      return;
    }
    const flick = Math.floor(s.spin) % 2, k = s.size;
    const box = (c, dx, dy, w, h) => { g.fillStyle = col(c); g.fillRect(Math.round(x + dx * k - w * k / 2), Math.round(y + dy * k - h * k / 2), Math.round(w * k), Math.round(h * k)); };
    box('--bebop-red', -Math.sign(s.vx) * (14 + flick * 2), 0, 8, 4);
    if (k > 1) box('--bebop-red', 0, 0, 16, 12);   // the super's red corona
    box('--amber', 0, 0, 12, 8);
    box('--cream', 0, 0, 6, 4);
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
    // Super meter along the bottom
    [p1, p2].forEach((f, k) => {
      const x = k ? W - 12 - 80 : 12, full = f.meter >= METER_MAX;
      g.fillStyle = col('--space-black'); g.fillRect(x - 1, 168, 82, 6);
      g.fillStyle = col(full && Math.floor(sceneT / 8) % 2 ? '--cream' : '--teal');
      const len = f.meter / METER_MAX * 80;
      g.fillRect(k ? x + 80 - len : x, 169, len, 4);
      text(full ? 'SUPER  MAX' : 'SUPER', k ? W - 12 : 12, 165, 10, col(full ? '--amber' : '--ink-dim'), k ? 'right' : 'left');
    });
  }

  // Arrows for the move lists, in a font that has them
  const moveText = (sp) => `${MOTIONS[sp.motion].label} ${sp.btn === 'punch' ? 'P' : 'K'}  ${sp.name}`;

  function render(t) {
    if (!stage) paintStage();
    g.save();
    if (shake > 0) g.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));
    g.drawImage(stage, 0, 0);

    if (scene === 'title' || scene === 'select') {
      const xs = [70, 160, 250];
      if (scene === 'title') ROSTER.forEach((d, k) => drawFighter(makeFighter(d, xs[k], k === 2 ? -1 : 1), t / 16 + k * 5));
      g.restore();
      g.fillStyle = col('--space-black'); g.globalAlpha = 0.55; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      if (scene === 'title') {
        g.font = 'bold 24px Syncopate, sans-serif'; g.textAlign = 'center';
        g.fillStyle = col('--bebop-red'); g.fillText('ROAD', W / 2 + 2, 60);
        g.fillStyle = col('--cream'); g.fillText('ROAD', W / 2, 58);
        g.fillStyle = col('--bebop-red'); g.fillText('FIGHTER', W / 2 + 2, 88);
        g.fillStyle = col('--amber'); g.fillText('FIGHTER', W / 2, 86);
        if (Math.floor(t / 500) % 2) text('PRESS START', W / 2, 122, 16, col('--cream'));
        text('1 PLAYER VS CPU   BEST OF 3', W / 2, 150, 11, col('--ink-dim'));
      } else {
        text('CHOOSE YOUR FIGHTER', W / 2, 20, 16, col('--cream'));
        ROSTER.forEach((d, k) => {
          const on = k === pick;
          g.fillStyle = col('--soot'); g.fillRect(xs[k] - 42, 28, 84, 100);
          g.strokeStyle = col(on ? '--amber' : '--rule'); g.lineWidth = on ? 2 : 1;
          g.strokeRect(xs[k] - 42, 28, 84, 100);
          drawFighter(Object.assign(makeFighter(d, xs[k], k === 2 ? -1 : 1), { y: 118, state: on ? 'win' : 'idle' }), t / 16 + k * 5);
          text(d.name, xs[k], 140, 13, col(on ? '--amber' : '--cream'));
          text(d.role, xs[k], 150, 10, col('--ink-dim'));
        });
        // The picked fighter's specials
        const sel = ROSTER[pick];
        g.font = '10px VT323, "Segoe UI Symbol", monospace'; g.textAlign = 'center';
        g.fillStyle = col('--cream');
        g.fillText(`${moveText(sel.specials[0])}     ${moveText(sel.specials[1])}`, W / 2, 160);
        g.fillStyle = col('--amber');
        g.fillText(`SUPER  ${moveText(sel.super)}`, W / 2, 169);
        text('< >  PICK     PUNCH / START  CONFIRM', W / 2, 178, 9, col('--ink-dim'));
      }
      return;
    }

    // The attacker draws on top
    const order = p1.state === 'attack' ? [p2, p1] : [p1, p2];
    [p1, p2].forEach((f) => { const foe = f === p1 ? p2 : p1; f.near = foe.state === 'attack' || shots.some((s) => s.owner === foe); });
    order.forEach((f) => drawFighter(f, sceneT));
    shots.forEach(drawShot);
    sparks.forEach((p) => {
      g.fillStyle = col(p.c);
      if (p.size > 2) g.globalAlpha = Math.min(1, p.life / 12) * 0.8;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      g.globalAlpha = 1;
    });
    g.restore();
    // Super flash: everything darkens and holds while the super user stands out
    if (freeze > 0 && freezeBy) {
      g.fillStyle = col('--space-black'); g.globalAlpha = 0.6; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      if (freeze > 40) { g.fillStyle = col('--cream'); g.globalAlpha = (freeze - 40) / 8; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      drawFighter(freezeBy, sceneT);
      const slide = Math.min(1, (46 - freeze) / 10);
      g.fillStyle = col('--bebop-red'); g.fillRect(0, 62, W * slide, 26);
      g.fillStyle = col('--amber'); g.fillRect(0, 88, W * slide, 2);
      g.font = 'bold 15px Syncopate, sans-serif'; g.textAlign = 'center';
      g.fillStyle = col('--space-black'); g.fillText(freezeBy.move.name, W / 2 + 1, 81);
      g.fillStyle = col('--cream'); g.fillText(freezeBy.move.name, W / 2, 80);
    }
    hud();
    // Combo counter on the attacker's side
    [p1, p2].forEach((f, k) => {
      if (f.comboShow > 0 && f.combo > 1) {
        text(`${f.combo} HITS`, k ? W - 14 : 14, 62, 20, col('--amber'), k ? 'right' : 'left');
        text('COMBO', k ? W - 14 : 14, 72, 11, col('--cream'), k ? 'right' : 'left');
      }
    });
    // Name a special as it lands, arcade style
    [p1, p2].forEach((f, k) => {
      if (f.state === 'attack' && f.moveKey === 'special' && f.t < 40) text(f.move.name, k ? W - 12 : 12, 40, 11, col('--amber'), k ? 'right' : 'left');
    });
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
    // The idle cabinet screen: title card with the three fighters
    attract(t) { if (!running) { scene = 'title'; render(t); } },
    get running() { return running; },
  };
}
