/* ==========================================================
   NIGHTSHIFT: the studio laptop's music app. An original,
   browser-made beat workstation: every sound is synthesised
   with Web Audio, nothing is sampled.

   Transport: play / stop, BPM (type, nudge or tap), swing,
   pattern length, key and scale, metronome, master volume.
   Channel rack: six drum voices on a step grid, four synths.
   Piano roll: scale-locked notes for the selected synth, with
   note length, chord mode for the pad, and live keyboard input
   (record while playing). Instrument: wave, octave, filter,
   envelope (synths) or tune and decay (drums). Mixer: volume,
   pan, mute, solo, reverb and delay sends, level meters.
   Demos, clear, autosave, and export of the loop as a WAV.
   ========================================================== */

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
const STORE = 'ag-daw';
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  'Major pentatonic': [0, 2, 4, 7, 9],
  'Minor pentatonic': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const DRUMS = [
  { id: 'kick', name: 'Kick' }, { id: 'snare', name: 'Snare' }, { id: 'clap', name: 'Clap' },
  { id: 'hat', name: 'Closed hat' }, { id: 'ohat', name: 'Open hat' }, { id: 'rim', name: 'Rim' },
];
const SYNTHS = [
  { id: 'bass', name: 'Bass', wave: 'sawtooth', octave: 2, cutoff: 0.32, res: 0.35, attack: 0.005, release: 0.12, detune: 0 },
  { id: 'lead', name: 'Lead', wave: 'square', octave: 4, cutoff: 0.55, res: 0.2, attack: 0.01, release: 0.18, detune: 6 },
  { id: 'pad', name: 'Pad', wave: 'sawtooth', octave: 3, cutoff: 0.4, res: 0.1, attack: 0.35, release: 0.9, detune: 12, chord: true },
  { id: 'keys', name: 'Keys', wave: 'triangle', octave: 4, cutoff: 0.7, res: 0.1, attack: 0.005, release: 0.4, detune: 3 },
];
const KEYMAP = 'awsedftgyhujkolp;';   // the bottom two rows of a keyboard, rising through the scale

/* ---------- Patterns ---------- */

function blank(steps = 16) {
  return {
    bpm: 92, swing: 0.12, steps, key: 9, scale: 'Minor', master: 0.8, metro: false, noteLen: 2, selected: 'lead',
    channels: [
      ...DRUMS.map((d) => ({ ...d, type: 'drum', vol: 0.8, pan: 0, mute: false, solo: false, rev: 0.1, dly: 0, tune: 0, decay: 0.5, steps: Array(32).fill(0) })),
      ...SYNTHS.map((s) => ({ ...s, type: 'synth', vol: 0.65, pan: 0, mute: false, solo: false, rev: 0.25, dly: s.id === 'lead' ? 0.25 : 0, notes: [] })),
    ],
  };
}
const ch = (st, id) => st.channels.find((c) => c.id === id);
const hits = (st, id, list) => { const c = ch(st, id); list.forEach((i) => { c.steps[i] = 1; }); };
const notes = (st, id, list) => { ch(st, id).notes = list.map(([step, deg, len]) => ({ step, deg, len })); };

// Original demo grooves to start from
const DEMOS = {
  'Late night': () => {
    const st = blank(16); Object.assign(st, { bpm: 82, swing: 0.34, key: 9, scale: 'Minor' });
    hits(st, 'kick', [0, 7, 10]); hits(st, 'snare', [4, 12]); hits(st, 'hat', [0, 2, 4, 6, 8, 10, 12, 14]); hits(st, 'rim', [15]);
    notes(st, 'pad', [[0, 0, 8], [8, 5, 8]]);
    notes(st, 'bass', [[0, 0, 3], [7, 0, 1], [8, 5, 3], [14, 4, 2]]);
    notes(st, 'keys', [[2, 7, 1], [3, 9, 1], [6, 11, 2], [10, 9, 1], [11, 7, 2]]);
    return st;
  },
  'Dock 9 boom bap': () => {
    const st = blank(16); Object.assign(st, { bpm: 90, swing: 0.22, key: 2, scale: 'Dorian' });
    hits(st, 'kick', [0, 3, 8, 11]); hits(st, 'snare', [4, 12]); hits(st, 'clap', [12]); hits(st, 'hat', [0, 2, 4, 6, 8, 10, 12, 14, 15]); hits(st, 'ohat', [7]);
    notes(st, 'bass', [[0, 0, 2], [3, 0, 1], [8, 3, 2], [11, 2, 1], [14, 4, 2]]);
    notes(st, 'lead', [[0, 7, 2], [4, 9, 1], [6, 8, 2], [12, 6, 3]]);
    return st;
  },
  'Hyperspace house': () => {
    const st = blank(16); Object.assign(st, { bpm: 122, swing: 0, key: 5, scale: 'Minor' });
    hits(st, 'kick', [0, 4, 8, 12]); hits(st, 'clap', [4, 12]); hits(st, 'hat', [1, 3, 5, 7, 9, 11, 13, 15]); hits(st, 'ohat', [2, 6, 10, 14]);
    notes(st, 'bass', [[2, 0, 1], [6, 0, 1], [10, 3, 1], [14, 4, 1]]);
    notes(st, 'lead', [[0, 7, 1], [2, 9, 1], [4, 11, 1], [6, 9, 1], [8, 7, 1], [10, 9, 1], [12, 12, 1], [14, 11, 1]]);
    notes(st, 'pad', [[0, 0, 16]]);
    return st;
  },
};

function load() {
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.channels) return s; } catch (e) { /* ignore */ }
  return DEMOS['Late night']();
}
function save(st) { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { /* ignore */ } }

/* ---------- Sound: shared by the live engine and the WAV export ---------- */

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function impulse(ctx, seconds = 2.2) {
  const len = ctx.sampleRate * seconds, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  return b;
}

// Build the mixing desk for a context: per-channel gain, pan and sends into master,
// a shared reverb and tape-ish delay, a gentle compressor at the end
function buildGraph(ctx, st) {
  const master = ctx.createGain();
  master.gain.value = st.master;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  master.connect(comp);
  const out = ctx.createGain();
  comp.connect(out);
  out.connect(ctx.destination);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx);
  reverb.connect(master);
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200;
  delay.connect(tone).connect(fb).connect(delay);
  tone.connect(master);
  const strips = {};
  st.channels.forEach((c) => {
    const g = ctx.createGain(), p = ctx.createStereoPanner(), rs = ctx.createGain(), ds = ctx.createGain();
    g.connect(p).connect(master);
    p.connect(rs).connect(reverb);
    p.connect(ds).connect(delay);
    const meter = ctx.createAnalyser(); meter.fftSize = 256;
    p.connect(meter);
    strips[c.id] = { g, p, rs, ds, meter };
  });
  const masterMeter = ctx.createAnalyser(); masterMeter.fftSize = 512;
  comp.connect(masterMeter);
  return { master, out, reverb, delay, strips, masterMeter, noise: noiseBuffer(ctx) };
}
function mixInto(graph, st, stepDur) {
  const solo = st.channels.some((c) => c.solo);
  st.channels.forEach((c) => {
    const s = graph.strips[c.id];
    const on = !c.mute && (!solo || c.solo);
    s.g.gain.value = on ? c.vol : 0;
    s.p.pan.value = c.pan;
    s.rs.gain.value = c.rev;
    s.ds.gain.value = c.dly;
  });
  graph.master.gain.value = st.master;
  graph.delay.delayTime.value = stepDur * 3;   // a dotted-eighth echo
}

function drum(ctx, graph, c, t) {
  const dest = graph.strips[c.id].g;
  const tune = Math.pow(2, c.tune / 12), dec = 0.4 + c.decay * 1.4;
  const env = (node, peak, len) => { const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len); node.connect(g).connect(dest); return g; };
  const noise = (len, type, freq, q, peak) => {
    const n = ctx.createBufferSource(); n.buffer = graph.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    n.connect(f); env(f, peak, len); n.start(t); n.stop(t + len + 0.05);
  };
  const tone = (type, f0, f1, len, peak) => {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0 * tune, t); o.frequency.exponentialRampToValueAtTime(f1 * tune, t + len * 0.7);
    env(o, peak, len); o.start(t); o.stop(t + len + 0.05);
  };
  if (c.id === 'kick') { tone('sine', 150, 42, 0.5 * dec, 1); noise(0.02, 'lowpass', 2500, 0.7, 0.3); }
  if (c.id === 'snare') { tone('triangle', 200, 140, 0.12 * dec, 0.5); noise(0.2 * dec, 'bandpass', 1900, 0.8, 0.7); }
  if (c.id === 'clap') { [0, 0.012, 0.024].forEach((d, i) => { const tt = t + d; const n = ctx.createBufferSource(); n.buffer = graph.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300 * tune; f.Q.value = 1.1; const g = ctx.createGain(); g.gain.setValueAtTime(0.7, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.18 * dec : 0.02)); n.connect(f).connect(g).connect(dest); n.start(tt); n.stop(tt + 0.3); }); }
  if (c.id === 'hat') noise(0.05 * dec, 'highpass', 7600 * tune, 0.7, 0.45);
  if (c.id === 'ohat') noise(0.32 * dec, 'highpass', 7000 * tune, 0.7, 0.4);
  if (c.id === 'rim') { tone('square', 820, 780, 0.05 * dec, 0.35); noise(0.02, 'bandpass', 3000, 2, 0.3); }
}

function scaleMidi(st, c, deg) {
  const sc = SCALES[st.scale], n = sc.length;
  const oct = Math.floor(deg / n), idx = ((deg % n) + n) % n;
  return 12 * (c.octave + 1) + st.key + sc[idx] + 12 * oct;
}
function synthNote(ctx, graph, st, c, deg, t, dur) {
  const dest = graph.strips[c.id].g;
  const degs = c.chord ? [deg, deg + 2, deg + 4] : [deg];   // pad plays a triad built on the scale
  degs.forEach((d) => {
    const f = midiHz(scaleMidi(st, c, d));
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    filt.frequency.value = 80 * Math.pow(150, c.cutoff); filt.Q.value = 0.5 + c.res * 14;
    const g = ctx.createGain();
    const peak = 0.32 / degs.length;
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.max(0.003, c.attack));
    g.gain.setTargetAtTime(peak * 0.7, t + c.attack, 0.12);
    g.gain.setTargetAtTime(0.0001, end, Math.max(0.02, c.release / 3));
    filt.connect(g).connect(dest);
    [-1, 1].forEach((side) => {
      if (side > 0 && !c.detune) return;
      const o = ctx.createOscillator(); o.type = c.wave; o.frequency.value = f; o.detune.value = side * c.detune;
      o.connect(filt); o.start(t); o.stop(end + c.release + 0.3);
    });
  });
}
function click(ctx, graph, t, accent) {
  const o = ctx.createOscillator(); o.frequency.value = accent ? 1760 : 1320;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(graph.master); o.start(t); o.stop(t + 0.06);
}
// Everything that sounds on one step
function playStep(ctx, graph, st, step, t, stepDur) {
  st.channels.forEach((c) => {
    if (c.type === 'drum' && c.steps[step]) drum(ctx, graph, c, t);
    if (c.type === 'synth') c.notes.forEach((n) => { if (n.step === step) synthNote(ctx, graph, st, c, n.deg, t, n.len * stepDur * 0.95); });
  });
  if (st.metro && step % 4 === 0) click(ctx, graph, t, step === 0);
}
const swingAt = (st, step, stepDur) => (step % 2 ? st.swing * stepDur * 0.66 : 0);

/* ---------- WAV encoding ---------- */

function wav(buffer) {
  const ch0 = buffer.getChannelData(0), ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const len = ch0.length, data = new DataView(new ArrayBuffer(44 + len * 4));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); data.setUint32(4, 36 + len * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, buffer.sampleRate, true); data.setUint32(28, buffer.sampleRate * 4, true);
  data.setUint16(32, 4, true); data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, len * 4, true);
  for (let i = 0, o = 44; i < len; i++, o += 4) {
    data.setInt16(o, Math.max(-1, Math.min(1, ch0[i])) * 0x7fff, true);
    data.setInt16(o + 2, Math.max(-1, Math.min(1, ch1[i])) * 0x7fff, true);
  }
  return new Blob([data], { type: 'audio/wav' });
}

/* ==========================================================
   The app
   ========================================================== */

export function createDaw(panel, { onPlayChange } = {}) {
  let st = load();
  let ctx = null, graph = null;
  let playing = false, step = 0, nextTime = 0, timer = 0, raf = 0;
  let view = 'rack';
  let rec = false;
  const queue = [];   // [audio time, step] so the playhead follows what's heard
  let shownStep = -1;
  let taps = [];
  let exportUrl = null;

  const $ = (sel) => panel.querySelector(sel);
  const stepDur = () => 60 / st.bpm / 4;
  const sel = () => ch(st, st.selected);
  const changed = () => { save(st); if (graph) mixInto(graph, st, stepDur()); };

  /* ---------- Audio ---------- */

  function ensureAudio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      graph = buildGraph(ctx, st);
      mixInto(graph, st, stepDur());
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.12) {
      const t = nextTime + swingAt(st, step, stepDur());
      playStep(ctx, graph, st, step, t, stepDur());
      queue.push([t, step]);
      nextTime += stepDur();
      step = (step + 1) % st.steps;
    }
  }
  function play() {
    ensureAudio();
    playing = true;
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    queue.length = 0;
    clearInterval(timer);
    timer = setInterval(tick, 25);
    tick();
    paintTransport();
    if (onPlayChange) onPlayChange(true);
  }
  function stop() {
    playing = false;
    clearInterval(timer);
    queue.length = 0;
    shownStep = -1;
    paintPlayhead();
    paintTransport();
    if (onPlayChange) onPlayChange(false);
  }
  // Audition a single note or hit, outside the sequence
  function audition(c, deg) {
    ensureAudio();
    const t = ctx.currentTime + 0.01;
    if (c.type === 'drum') drum(ctx, graph, c, t);
    else synthNote(ctx, graph, st, c, deg, t, stepDur() * 2);
  }

  /* ---------- Layout ---------- */

  panel.innerHTML = `
    <div class="daw__head">
      <p class="daw__brand"><span class="lamp" aria-hidden="true"></span>NIGHTSHIFT <span>/ studio laptop</span></p>
      <p class="daw__saved" data-d="saved" aria-live="polite"></p>
      <button class="tv__btn" type="button" data-d="close">Close <kbd>Esc</kbd></button>
    </div>
    <div class="daw__transport" role="group" aria-label="Transport">
      <button class="daw__play" type="button" data-d="play" aria-pressed="false">Play</button>
      <button class="daw__btn" type="button" data-d="rec" aria-pressed="false" title="Record keyboard notes into the piano roll while playing">Rec</button>
      <label class="daw__field"><span>BPM</span>
        <span class="daw__bpm"><button type="button" class="daw__nudge" data-d="bpm-" aria-label="Slower">-</button><input type="number" min="50" max="200" step="1" data-d="bpm" aria-label="Tempo in BPM"><button type="button" class="daw__nudge" data-d="bpm+" aria-label="Faster">+</button></span>
      </label>
      <button class="daw__btn" type="button" data-d="tap">Tap</button>
      <label class="daw__field"><span>Swing <output data-d="swing-out"></output></span><input type="range" min="0" max="0.6" step="0.01" data-d="swing"></label>
      <label class="daw__field"><span>Steps</span><select data-d="steps"><option value="16">16</option><option value="32">32</option></select></label>
      <label class="daw__field"><span>Key</span><select data-d="key">${NOTE_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
      <label class="daw__field"><span>Scale</span><select data-d="scale">${Object.keys(SCALES).map((s) => `<option>${s}</option>`).join('')}</select></label>
      <button class="daw__btn" type="button" data-d="metro" aria-pressed="false">Click</button>
      <label class="daw__field"><span>Master</span><input type="range" min="0" max="1" step="0.01" data-d="master"></label>
      <canvas class="daw__meter" data-d="meter" width="80" height="22" aria-hidden="true"></canvas>
    </div>
    <div class="daw__tabs" role="tablist" aria-label="Views">
      <button role="tab" type="button" data-view="rack">Channel rack</button>
      <button role="tab" type="button" data-view="roll">Piano roll</button>
      <button role="tab" type="button" data-view="mixer">Mixer</button>
      <span class="daw__spacer"></span>
      <label class="daw__field daw__field--inline"><span>Demo</span><select data-d="demo"><option value="">Load a demo</option>${Object.keys(DEMOS).map((d) => `<option>${d}</option>`).join('')}</select></label>
      <button class="daw__btn" type="button" data-d="clear">Clear</button>
      <button class="daw__btn" type="button" data-d="export">Render WAV</button>
      <a class="daw__btn daw__dl" data-d="download" hidden download="nightshift-loop.wav">Save WAV</a>
    </div>
    <div class="daw__body">
      <section class="daw__view" data-panel="rack" aria-label="Channel rack"></section>
      <section class="daw__view" data-panel="roll" aria-label="Piano roll" hidden></section>
      <section class="daw__view" data-panel="mixer" aria-label="Mixer" hidden></section>
      <aside class="daw__inst" data-d="inst" aria-label="Instrument"></aside>
    </div>
    <p class="daw__hint">Space plays and stops. In the piano roll, the keys ${KEYMAP.slice(0, 8).toUpperCase().split('').join(' ')}… play the selected synth in key; arm Rec while playing to write them in.</p>`;

  const rack = $('[data-panel="rack"]'), roll = $('[data-panel="roll"]'), mixer = $('[data-panel="mixer"]'), inst = $('[data-d="inst"]');

  /* ---------- Channel rack ---------- */

  function paintRack() {
    const cells = (c) => Array.from({ length: st.steps }, (_, i) => {
      if (c.type === 'drum') return `<button type="button" class="daw__step${c.steps[i] ? ' is-on' : ''}${Math.floor(i / 4) % 2 ? ' is-alt' : ''}" data-step="${i}" aria-pressed="${!!c.steps[i]}" aria-label="${c.name} step ${i + 1}"></button>`;
      const has = c.notes.some((n) => i >= n.step && i < n.step + n.len);
      return `<span class="daw__step daw__step--peek${has ? ' is-on' : ''}${Math.floor(i / 4) % 2 ? ' is-alt' : ''}" data-step="${i}"></span>`;
    }).join('');
    rack.innerHTML = `<div class="daw__rows" style="--steps:${st.steps}">${st.channels.map((c) => `
      <div class="daw__row${st.selected === c.id ? ' is-sel' : ''}" data-ch="${c.id}">
        <button type="button" class="daw__name" data-act="select">${c.name}</button>
        <button type="button" class="daw__ms${c.mute ? ' is-on' : ''}" data-act="mute" aria-pressed="${c.mute}" aria-label="Mute ${c.name}">M</button>
        <button type="button" class="daw__ms${c.solo ? ' is-on' : ''}" data-act="solo" aria-pressed="${c.solo}" aria-label="Solo ${c.name}">S</button>
        <input type="range" class="daw__mini" min="0" max="1" step="0.01" value="${c.vol}" data-act="vol" aria-label="${c.name} volume">
        <div class="daw__steps">${cells(c)}</div>
      </div>`).join('')}</div>`;
  }
  rack.addEventListener('click', (e) => {
    const row = e.target.closest('[data-ch]');
    if (!row) return;
    const c = ch(st, row.dataset.ch);
    const act = e.target.dataset.act;
    if (act === 'select') { st.selected = c.id; audition(c, 0); paintAll(); return; }
    if (act === 'mute' || act === 'solo') { c[act] = !c[act]; changed(); paintRack(); return; }
    const cell = e.target.closest('[data-step]');
    if (!cell) return;
    const i = Number(cell.dataset.step);
    if (c.type === 'drum') { c.steps[i] = c.steps[i] ? 0 : 1; if (c.steps[i]) audition(c); changed(); paintRack(); }
    else { st.selected = c.id; setView('roll'); }
  });
  rack.addEventListener('input', (e) => {
    if (e.target.dataset.act !== 'vol') return;
    ch(st, e.target.closest('[data-ch]').dataset.ch).vol = Number(e.target.value);
    changed();
  });

  /* ---------- Piano roll ---------- */

  const rows = () => SCALES[st.scale].length * 2 + 1;   // two octaves of the scale and the top note
  const noteName = (c, deg) => { const m = scaleMidi(st, c, deg); return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`; };
  function paintRoll() {
    const c = sel();
    if (c.type !== 'synth') {
      roll.innerHTML = `<p class="daw__empty">Pick a synth (Bass, Lead, Pad or Keys) in the rack to write notes. Drums live on the step grid.</p>`;
      return;
    }
    const R = rows();
    let html = `<div class="daw__rollbar"><span>${c.name}${c.chord ? ' / chords' : ''} in ${NOTE_NAMES[st.key]} ${st.scale}</span>
      <label class="daw__field daw__field--inline"><span>New note</span><select data-d="len">${[1, 2, 4, 8].map((n) => `<option value="${n}"${st.noteLen === n ? ' selected' : ''}>${n} step${n > 1 ? 's' : ''}</option>`).join('')}</select></label></div>
      <div class="daw__grid" style="--steps:${st.steps}">`;
    for (let r = R - 1; r >= 0; r--) {
      const root = r % SCALES[st.scale].length === 0;
      html += `<button type="button" class="daw__key${root ? ' is-root' : ''}" data-deg="${r}">${noteName(c, r)}</button>`;
      for (let i = 0; i < st.steps; i++) {
        const n = c.notes.find((x) => x.deg === r && i >= x.step && i < x.step + x.len);
        const cls = n ? (n.step === i ? ' is-on' : ' is-hold') : '';
        html += `<button type="button" class="daw__cell${cls}${root ? ' is-root' : ''}${Math.floor(i / 4) % 2 ? ' is-alt' : ''}" data-deg="${r}" data-step="${i}" aria-label="${noteName(c, r)} step ${i + 1}${n ? ', note' : ''}"></button>`;
      }
    }
    roll.innerHTML = html + '</div>';
  }
  roll.addEventListener('click', (e) => {
    const c = sel();
    const key = e.target.closest('.daw__key');
    if (key) { audition(c, Number(key.dataset.deg)); return; }
    const cell = e.target.closest('.daw__cell');
    if (!cell) return;
    const deg = Number(cell.dataset.deg), i = Number(cell.dataset.step);
    const hit = c.notes.findIndex((n) => n.deg === deg && i >= n.step && i < n.step + n.len);
    if (hit >= 0) c.notes.splice(hit, 1);
    else { c.notes.push({ step: i, deg, len: Math.min(st.noteLen, st.steps - i) }); audition(c, deg); }
    changed();
    paintRoll();
    paintRack();
  });
  roll.addEventListener('change', (e) => { if (e.target.dataset.d === 'len') { st.noteLen = Number(e.target.value); changed(); } });

  /* ---------- Mixer ---------- */

  function paintMixer() {
    mixer.innerHTML = `<div class="daw__strips">${st.channels.map((c) => `
      <div class="daw__strip" data-ch="${c.id}">
        <p class="daw__stripname">${c.name}</p>
        <canvas class="daw__level" data-level="${c.id}" width="10" height="90" aria-hidden="true"></canvas>
        <label><span>Vol</span><input type="range" min="0" max="1" step="0.01" value="${c.vol}" data-act="vol" aria-label="${c.name} volume"></label>
        <label><span>Pan</span><input type="range" min="-1" max="1" step="0.01" value="${c.pan}" data-act="pan" aria-label="${c.name} pan"></label>
        <label><span>Verb</span><input type="range" min="0" max="1" step="0.01" value="${c.rev}" data-act="rev" aria-label="${c.name} reverb send"></label>
        <label><span>Delay</span><input type="range" min="0" max="1" step="0.01" value="${c.dly}" data-act="dly" aria-label="${c.name} delay send"></label>
        <div class="daw__msrow">
          <button type="button" class="daw__ms${c.mute ? ' is-on' : ''}" data-act="mute" aria-pressed="${c.mute}" aria-label="Mute ${c.name}">M</button>
          <button type="button" class="daw__ms${c.solo ? ' is-on' : ''}" data-act="solo" aria-pressed="${c.solo}" aria-label="Solo ${c.name}">S</button>
        </div>
      </div>`).join('')}</div>`;
  }
  mixer.addEventListener('input', (e) => {
    const strip = e.target.closest('[data-ch]'); const act = e.target.dataset.act;
    if (!strip || !act) return;
    ch(st, strip.dataset.ch)[act] = Number(e.target.value);
    changed();
  });
  mixer.addEventListener('click', (e) => {
    const strip = e.target.closest('[data-ch]'); const act = e.target.dataset.act;
    if (!strip || (act !== 'mute' && act !== 'solo')) return;
    const c = ch(st, strip.dataset.ch); c[act] = !c[act];
    changed(); paintMixer(); paintRack();
  });

  /* ---------- Instrument panel ---------- */

  // How each instrument control reads out
  const FMT = {
    tune: (v) => `${v > 0 ? '+' : ''}${v} st`, decay: (v) => Number(v).toFixed(2),
    cutoff: (v) => `${Math.round(80 * Math.pow(150, v))} Hz`, res: (v) => Number(v).toFixed(2),
    attack: (v) => `${Math.round(v * 1000)} ms`, release: (v) => `${Number(v).toFixed(2)} s`, detune: (v) => `${v} c`,
  };
  function paintInst() {
    const c = sel();
    const knob = (label, key, min, max, stepv, fmt = FMT[key]) => `<label class="daw__knob"><span>${label} <output>${fmt(c[key])}</output></span><input type="range" min="${min}" max="${max}" step="${stepv}" value="${c[key]}" data-ip="${key}"></label>`;
    inst.innerHTML = `<p class="daw__insttitle">${c.name}</p>${c.type === 'drum'
      ? knob('Tune', 'tune', -12, 12, 1, (v) => `${v > 0 ? '+' : ''}${v} st`) + knob('Decay', 'decay', 0, 1, 0.01, (v) => Number(v).toFixed(2))
      : `<label class="daw__knob"><span>Wave</span><select data-ip="wave">${['sawtooth', 'square', 'triangle', 'sine'].map((w) => `<option${c.wave === w ? ' selected' : ''}>${w}</option>`).join('')}</select></label>
         <div class="daw__oct"><span>Octave ${c.octave}</span><button type="button" class="daw__nudge" data-oct="-1" aria-label="Octave down">-</button><button type="button" class="daw__nudge" data-oct="1" aria-label="Octave up">+</button></div>
         ${knob('Cutoff', 'cutoff', 0, 1, 0.01, (v) => `${Math.round(80 * Math.pow(150, v))} Hz`)}
         ${knob('Resonance', 'res', 0, 1, 0.01, (v) => Number(v).toFixed(2))}
         ${knob('Attack', 'attack', 0.001, 1, 0.001, (v) => `${Math.round(v * 1000)} ms`)}
         ${knob('Release', 'release', 0.02, 2, 0.01, (v) => `${Number(v).toFixed(2)} s`)}
         ${knob('Detune', 'detune', 0, 30, 1, (v) => `${v} c`)}
         <label class="daw__check"><input type="checkbox" data-ip="chord"${c.chord ? ' checked' : ''}> Play chords</label>`}
      <button type="button" class="daw__btn daw__wide" data-ip="audition">Audition</button>`;
  }
  inst.addEventListener('input', (e) => {
    const key = e.target.dataset.ip; if (!key) return;
    const c = sel();
    c[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.tagName === 'SELECT' ? e.target.value : Number(e.target.value);
    const out = e.target.closest('label') && e.target.closest('label').querySelector('output');
    if (out && FMT[key]) out.textContent = FMT[key](c[key]);
    changed();
    if (key === 'chord') paintRoll();
  });
  inst.addEventListener('click', (e) => {
    const c = sel();
    if (e.target.dataset.oct) { c.octave = Math.max(1, Math.min(6, c.octave + Number(e.target.dataset.oct))); changed(); paintInst(); paintRoll(); audition(c, 0); }
    if (e.target.dataset.ip === 'audition') audition(c, 0);
  });

  /* ---------- Transport ---------- */

  function paintTransport() {
    $('[data-d="play"]').textContent = playing ? 'Stop' : 'Play';
    $('[data-d="play"]').setAttribute('aria-pressed', String(playing));
    $('[data-d="rec"]').setAttribute('aria-pressed', String(rec));
    $('[data-d="bpm"]').value = st.bpm;
    $('[data-d="swing"]').value = st.swing;
    $('[data-d="swing-out"]').textContent = `${Math.round(st.swing * 100)}%`;
    $('[data-d="steps"]').value = String(st.steps);
    $('[data-d="key"]').value = String(st.key);
    $('[data-d="scale"]').value = st.scale;
    $('[data-d="metro"]').setAttribute('aria-pressed', String(st.metro));
    $('[data-d="master"]').value = st.master;
  }
  function setBpm(v) { st.bpm = Math.max(50, Math.min(200, Math.round(v))); changed(); paintTransport(); }
  panel.addEventListener('click', (e) => {
    const d = e.target.closest('[data-d]') && e.target.closest('[data-d]').dataset.d;
    if (d === 'play') (playing ? stop() : play());
    if (d === 'rec') { rec = !rec; paintTransport(); }
    if (d === 'bpm-') setBpm(st.bpm - 1);
    if (d === 'bpm+') setBpm(st.bpm + 1);
    if (d === 'metro') { st.metro = !st.metro; changed(); paintTransport(); }
    if (d === 'tap') {
      const now = performance.now();
      taps = taps.filter((x) => now - x < 2500).concat(now);
      if (taps.length > 1) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
    }
    if (d === 'clear') { const keep = { bpm: st.bpm, key: st.key, scale: st.scale, steps: st.steps }; st = Object.assign(blank(st.steps), keep); rebuildGraph(); paintAll(); changed(); }
    if (d === 'export') renderWav();
    const tab = e.target.closest('[data-view]');
    if (tab) setView(tab.dataset.view);
  });
  panel.addEventListener('change', (e) => {
    const d = e.target.dataset.d;
    if (d === 'bpm') setBpm(Number(e.target.value) || st.bpm);
    if (d === 'steps') { st.steps = Number(e.target.value); step %= st.steps; changed(); paintAll(); }
    if (d === 'key') { st.key = Number(e.target.value); changed(); paintRoll(); }
    if (d === 'scale') { st.scale = e.target.value; st.channels.forEach((c) => { if (c.notes) c.notes = c.notes.filter((n) => n.deg < rows()); }); changed(); paintRoll(); paintRack(); }
    if (d === 'demo' && DEMOS[e.target.value]) { st = DEMOS[e.target.value](); rebuildGraph(); e.target.value = ''; paintAll(); changed(); }
  });
  panel.addEventListener('input', (e) => {
    const d = e.target.dataset.d;
    if (d === 'swing') { st.swing = Number(e.target.value); $('[data-d="swing-out"]').textContent = `${Math.round(st.swing * 100)}%`; changed(); }
    if (d === 'master') { st.master = Number(e.target.value); changed(); }
  });
  function rebuildGraph() { if (ctx) { graph.out.disconnect(); graph = buildGraph(ctx, st); mixInto(graph, st, stepDur()); } }

  // Space plays and stops; the keyboard plays the selected synth in key
  const held = new Set();
  panel.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input[type="number"], select');
    if (e.key === ' ' && !typing && !e.target.closest('button, a')) { e.preventDefault(); playing ? stop() : play(); return; }
    if (e.key === ' ' && e.target.closest('button') && e.target.dataset.d !== 'play') { e.preventDefault(); playing ? stop() : play(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const k = KEYMAP.indexOf(e.key.toLowerCase());
    if (k < 0 || view !== 'roll' || sel().type !== 'synth') return;
    e.preventDefault();
    if (held.has(k)) return;
    held.add(k);
    const c = sel();
    audition(c, k);
    if (rec && playing && k < rows()) {
      const at = Math.max(0, shownStep);
      if (!c.notes.some((n) => n.deg === k && n.step === at)) { c.notes.push({ step: at, deg: k, len: Math.min(st.noteLen, st.steps - at) }); changed(); paintRoll(); paintRack(); }
    }
  });
  panel.addEventListener('keyup', (e) => held.delete(KEYMAP.indexOf(e.key.toLowerCase())));

  /* ---------- Export ---------- */

  async function renderWav() {
    const btn = $('[data-d="export"]');
    btn.textContent = 'Rendering…';
    const loops = 2, sd = stepDur(), len = loops * st.steps * sd + 2.5;
    const off = new OfflineAudioContext(2, Math.ceil(44100 * len), 44100);
    const g = buildGraph(off, st);
    mixInto(g, st, sd);
    for (let k = 0; k < loops * st.steps; k++) playStep(off, g, st, k % st.steps, 0.05 + k * sd + swingAt(st, k % st.steps, sd), sd);
    const buf = await off.startRendering();
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(wav(buf));
    const a = $('[data-d="download"]');
    a.href = exportUrl;
    a.hidden = false;
    btn.textContent = 'Render WAV';
    $('[data-d="saved"]').textContent = `Rendered ${loops} loops, ${len.toFixed(1)} s`;
  }

  /* ---------- Views and live drawing ---------- */

  function setView(v) {
    view = v;
    [rack, roll, mixer].forEach((p) => { p.hidden = p.dataset.panel !== v; });
    panel.querySelectorAll('[data-view]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === v)));
    if (v === 'roll') paintRoll();
    if (v === 'mixer') paintMixer();
  }
  function paintAll() { paintTransport(); paintRack(); paintRoll(); paintMixer(); paintInst(); setView(view); }

  function paintPlayhead() {
    panel.querySelectorAll('.is-head').forEach((n) => n.classList.remove('is-head'));
    if (shownStep < 0) return;
    panel.querySelectorAll(`[data-step="${shownStep}"]`).forEach((n) => n.classList.add('is-head'));
  }
  const level = (an) => { const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i] - 128)); return m / 128; };
  function frame() {
    raf = requestAnimationFrame(frame);
    if (playing && ctx) {
      while (queue.length && queue[0][0] <= ctx.currentTime) {
        const [, s] = queue.shift();
        if (s !== shownStep) { shownStep = s; paintPlayhead(); }
      }
    }
    if (!graph) return;
    const mc = $('[data-d="meter"]').getContext('2d');
    const lv = Math.min(1, level(graph.masterMeter) * 1.4);
    mc.fillStyle = token('--space-black'); mc.fillRect(0, 0, 80, 22);
    mc.fillStyle = token(lv > 0.85 ? '--bebop-red' : '--neon'); mc.fillRect(0, 4, 80 * lv, 14);
    if (view === 'mixer') {
      panel.querySelectorAll('[data-level]').forEach((cv) => {
        const g = cv.getContext('2d'); const v = Math.min(1, level(graph.strips[cv.dataset.level].meter) * 1.6);
        g.fillStyle = token('--space-black'); g.fillRect(0, 0, 10, 90);
        g.fillStyle = token(v > 0.85 ? '--bebop-red' : '--amber'); g.fillRect(0, 90 - 90 * v, 10, 90 * v);
      });
    }
  }

  paintAll();

  return {
    open() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    close() { cancelAnimationFrame(raf); if (playing) stop(); },
    get playing() { return playing; },
    // A small picture of the pattern for the laptop screen in the room
    snapshot() { return { st, step: shownStep, playing }; },
  };
}
