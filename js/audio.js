(() => {
  'use strict';

  // Flow: the boot screen hisses with static; "Power on" plays the tube
  // start-up and, once the boot finishes, the music. "Silent" stays quiet.
  // Effects are synthesised with Web Audio; the music is a looping <audio>.

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  const MUSIC_LEVEL = 0.5;  // music sits under the effects, quietly
  const SFX_LEVEL = 0.9;

  let enabled = store.get('ag-sound') === 'on';
  // Music only ever starts after this session's power-on (or the SND switch)
  let powered = session.get('ag-powered') === '1';
  let volume = Math.min(1, Math.max(0, parseFloat(store.get('ag-volume') ?? '0.3')));
  if (Number.isNaN(volume)) volume = 0.3;

  const music = new Audio('assets/audio/road-to-the-west.mp3');
  music.loop = true;
  music.preload = 'none';
  music.volume = volume * MUSIC_LEVEL;
  music.className = 'sr-only';
  music.setAttribute('aria-hidden', 'true');
  document.body.appendChild(music);   // in the DOM so devtools and media keys can find it

  let ctx = null, out = null, noise = null;

  const audio = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = volume * SFX_LEVEL;
      out.connect(ctx.destination);
      // One second of white noise, reused by every effect
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  const live = () => ctx && ctx.state === 'running';

  // Envelope helper: silence -> peak -> silence
  const env = (gain, t, attack, peak, release) => {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  };
  const noiseSource = (t, dur) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.start(t, Math.random() * 0.9);
    if (dur) src.stop(t + dur);
    return src;
  };
  const tone = (type, f0, f1, t, dur, peak, attack = 0.005) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = ctx.createGain();
    env(g, t, attack, peak, dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + attack + dur + 0.05);
  };
  const hiss = (t, dur, peak, type = 'highpass', freq = 1200) => {
    const s = noiseSource(t, dur + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    env(g, t, 0.01, peak, dur);
    s.connect(f).connect(g).connect(out);
  };

  /* ---------- Standby static on the boot screen ---------- */

  let standby = null;
  function startStatic() {
    if (standby || !ctx || !live()) return;
    const t = ctx.currentTime;
    const s = noiseSource(t);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.6);
    // A slow, uneven swell, like a set between channels
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const depth = ctx.createGain();
    depth.gain.value = 0.015;
    lfo.connect(depth).connect(g.gain);
    s.connect(bp).connect(g).connect(out);
    lfo.start(t);
    standby = { s, g, lfo };
  }
  function stopStatic(fade = 0.4) {
    if (!standby) return;
    const t = ctx.currentTime;
    standby.g.gain.cancelScheduledValues(t);
    standby.g.gain.setValueAtTime(standby.g.gain.value, t);
    standby.g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    standby.s.stop(t + fade + 0.05);
    standby.lfo.stop(t + fade + 0.05);
    standby = null;
  }

  /* ---------- Hover: a short electrical buzz ---------- */

  let lastBuzz = 0;
  function buzz() {
    if (!enabled || !live()) return;
    const t = ctx.currentTime;
    if (t - lastBuzz < 0.05) return;
    lastBuzz = t;

    // Mains hum: 120Hz square through a low-pass, pitch nudged each time
    const hum = ctx.createOscillator();
    hum.type = 'square';
    hum.frequency.value = 112 + Math.random() * 16;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const hg = ctx.createGain();
    env(hg, t, 0.008, 0.07, 0.11);
    hum.connect(lp).connect(hg).connect(out);
    hum.start(t);
    hum.stop(t + 0.14);
    hiss(t, 0.05, 0.05, 'bandpass', 2600 + Math.random() * 1500);
  }

  /* ---------- Click: a small channel-change zap ---------- */

  let lastZap = 0;
  function zap() {
    if (!enabled || !live()) return;
    const t = ctx.currentTime;
    if (t - lastZap < 0.12) return;
    lastZap = t;
    tone('sine', 140, 55, t, 0.14, 0.14);                 // soft relay click
    hiss(t, 0.22, 0.07);                                    // static snap
    tone('sine', 5200, 8600, t + 0.02, 0.22, 0.012, 0.02);  // brief whine
    tone('sawtooth', 62, 58, t + 0.03, 0.3, 0.03, 0.03);    // a breath of hum
  }

  /* ---------- Door: a heavy panel sliding on a metal track ---------- */

  function slide() {
    if (!enabled || !live()) return;
    const t = ctx.currentTime;
    // The scrape: band-passed noise swept upward as the panel picks up speed
    const s = noiseSource(t, 1.0);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(380, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.55);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.85);
    const sg = ctx.createGain();
    env(sg, t, 0.08, 0.22, 0.75);
    s.connect(bp).connect(sg).connect(out);
    // The motor underneath
    tone('sawtooth', 52, 70, t, 0.8, 0.08, 0.06);
    // A metallic ring and the clunk at the end of travel
    tone('triangle', 1850, 1700, t + 0.05, 0.5, 0.012, 0.02);
    tone('sine', 120, 45, t + 0.82, 0.22, 0.32);
    hiss(t + 0.82, 0.12, 0.08, 'lowpass', 900);
  }

  /* ---------- Console beep ---------- */

  function beep() {
    if (!enabled || !live()) return;
    const t = ctx.currentTime;
    const f = [880, 1175, 1320, 1568][(Math.random() * 4) | 0];
    tone('square', f, f, t, 0.06, 0.018, 0.004);
    if (Math.random() < 0.5) tone('square', f * 1.25, f * 1.25, t + 0.11, 0.05, 0.015, 0.004);
  }

  /* ---------- Power-on: thunk, static, degauss, flyback whine ---------- */

  function powerOn() {
    if (!audio()) return;
    const t = ctx.currentTime + 0.02;
    tone('sine', 110, 38, t, 0.3, 0.5);   // relay thunk
    hiss(t + 0.02, 0.8, 0.16);              // static burst as the tube charges

    // Degauss: a wobbling low hum that dies away
    const dg = ctx.createOscillator();
    dg.type = 'sawtooth';
    dg.frequency.value = 60;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 260;
    const dgain = ctx.createGain();
    env(dgain, t + 0.1, 0.05, 0.14, 1.3);
    const wob = ctx.createOscillator();
    wob.frequency.value = 9;
    const wobDepth = ctx.createGain();
    wobDepth.gain.value = 0.06;
    wob.connect(wobDepth).connect(dgain.gain);
    dg.connect(dlp).connect(dgain).connect(out);
    dg.start(t + 0.1); dg.stop(t + 1.6);
    wob.start(t + 0.1); wob.stop(t + 1.6);

    // Flyback whine: sweeps up into a thin high tone, then settles quiet
    const w = ctx.createOscillator();
    w.type = 'sine';
    w.frequency.setValueAtTime(2400, t);
    w.frequency.exponentialRampToValueAtTime(11800, t + 0.55);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.exponentialRampToValueAtTime(0.05, t + 0.2);
    wg.gain.exponentialRampToValueAtTime(0.018, t + 1.2);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    w.connect(wg).connect(out);
    w.start(t); w.stop(t + 3.3);
  }

  /* ---------- Music ---------- */

  let resumeAt = parseFloat(session.get('ag-music-t') || '0') || 0;

  function playMusic() {
    if (!enabled || !powered) return;
    music.muted = false;
    if (resumeAt) {
      const seek = () => { try { music.currentTime = resumeAt; } catch (e) { /* ignore */ } resumeAt = 0; };
      if (music.readyState >= 1) seek(); else music.addEventListener('loadedmetadata', seek, { once: true });
    }
    music.play().catch(() => { /* blocked until a gesture; unlock() retries */ });
  }
  // Inside the power-on gesture, start the element silently so browsers that
  // demand a gesture (Safari) still let it play when the boot finishes.
  function primeMusic() {
    music.muted = true;
    music.play().then(() => { if (music.muted) music.pause(); }).catch(() => {});
  }

  window.addEventListener('pagehide', () => {
    session.set('ag-music-t', music.paused ? '0' : String(music.currentTime));
  });

  /* ---------- State ---------- */

  const listeners = [];
  function setEnabled(on) {
    enabled = on;
    store.set('ag-sound', on ? 'on' : 'off');
    if (on) {
      powered = true;
      session.set('ag-powered', '1');
      audio();
      playMusic();
    } else {
      music.pause();
      if (ctx) stopStatic(0.2);
    }
    listeners.forEach((fn) => fn());
  }
  function setVolume(v) {
    volume = v;
    store.set('ag-volume', String(v));
    music.volume = v * MUSIC_LEVEL;
    if (out) out.gain.setTargetAtTime(v * SFX_LEVEL, ctx.currentTime, 0.02);
    listeners.forEach((fn) => fn());
  }

  /* ---------- Boot screen hooks (dispatched by main.js) ---------- */

  const booting = () => {
    const b = document.getElementById('boot');
    return b && b.classList.contains('is-on') && !b.classList.contains('is-powered');
  };

  // Try static straight away; most browsers hold it until the first gesture
  if (booting()) {
    audio();
    if (live()) startStatic();
    else if (ctx) ctx.addEventListener('statechange', () => { if (live() && booting()) startStatic(); });
  }

  document.addEventListener('ag:power', (e) => {
    if (e.detail.sound) {
      enabled = true;
      powered = true;
      store.set('ag-sound', 'on');
      session.set('ag-powered', '1');
      audio();
      stopStatic(0.25);
      powerOn();
      primeMusic();
      listeners.forEach((fn) => fn());
    } else {
      if (ctx) stopStatic(0.3);
      setEnabled(false);
    }
  });
  // The wanted page is up: the music comes in
  document.addEventListener('ag:boot-done', () => playMusic());

  // Browsers hold audio until a gesture; the first one unlocks it
  const unlock = () => {
    if (booting()) { audio(); startStatic(); return; }
    if (!enabled || !powered) return;
    audio();
    if (music.paused) playMusic();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((type) => {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  });
  // Later pages this session pick the track back up where it was
  if (powered && !booting()) playMusic();

  /* ---------- Hover buzz and click zap ---------- */

  const TARGETS = 'a, button, [role="button"], input, .key, .mug, .rack__slots li';
  let current = null;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest(TARGETS);
    if (el === current) return;
    current = el;
    if (el) buzz();
  });
  document.addEventListener('focusin', (e) => {
    if (e.target.matches(':focus-visible') && e.target.closest(TARGETS)) buzz();
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button, .key, .mug');
    if (!el || el.closest('[data-power]')) return;   // the power switch has its own sound
    zap();
  }, true);

  /* ---------- SND panel in the top bar ---------- */

  function panel() {
    const bar = document.querySelector('.bar');
    const fxBtn = bar && bar.querySelector('[data-fx]');
    if (!bar || !fxBtn) return;

    const wrap = document.createElement('div');
    wrap.className = 'snd';
    wrap.innerHTML = `
      <button class="snd__toggle" type="button" aria-expanded="false" aria-controls="snd-panel">
        <span class="snd__lamp" aria-hidden="true"></span>SND
      </button>
      <div class="snd__panel" id="snd-panel" role="group" aria-label="Sound" hidden>
        <p class="snd__track"><span>Now playing</span>Road to the West / Seatbelts</p>
        <button class="snd__power" type="button" aria-pressed="false"></button>
        <label class="snd__vol">
          <span class="snd__vol-label">Volume <output class="snd__vol-num"></output></span>
          <input class="snd__range" type="range" min="0" max="100" step="1">
        </label>
        <p class="snd__note">Plays on a loop. Effects buzz on hover.</p>
      </div>`;
    bar.insertBefore(wrap, fxBtn);

    const toggle = wrap.querySelector('.snd__toggle');
    const box = wrap.querySelector('.snd__panel');
    const powerBtn = wrap.querySelector('.snd__power');
    const range = wrap.querySelector('.snd__range');
    const num = wrap.querySelector('.snd__vol-num');

    const paint = () => {
      wrap.classList.toggle('is-on', enabled);
      powerBtn.textContent = enabled ? 'Sound on' : 'Sound off';
      powerBtn.setAttribute('aria-pressed', String(enabled));
      toggle.setAttribute('aria-label', `Sound ${enabled ? 'on' : 'off'}, volume ${Math.round(volume * 100)}. Open sound controls`);
      range.value = String(Math.round(volume * 100));
      range.style.setProperty('--fill', `${Math.round(volume * 100)}%`);
      num.textContent = String(Math.round(volume * 100));
    };
    paint();
    listeners.push(paint);

    const open = (show) => {
      box.hidden = !show;
      toggle.setAttribute('aria-expanded', String(show));
    };
    toggle.addEventListener('click', () => open(box.hidden));
    powerBtn.addEventListener('click', () => setEnabled(!enabled));
    range.addEventListener('input', () => {
      setVolume(Number(range.value) / 100);
      if (!enabled && volume > 0) setEnabled(true);
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) open(false); });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { open(false); toggle.focus(); }
    });
  }

  panel();

  // Other scripts (the 3D lounge) can borrow the effects
  window.agSound = { buzz, zap, slide, beep };
})();
