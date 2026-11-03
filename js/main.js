(() => {
  'use strict';

  const root = document.documentElement;
  const css = getComputedStyle(root);
  const token = (name) => css.getPropertyValue(name).trim();

  // The head script already chose fx-on / fx-off; this keeps it live.
  const fx = {
    on: root.classList.contains('fx-on'),
    listeners: [],
    set(on, store = true) {
      this.on = on;
      root.classList.toggle('fx-on', on);
      root.classList.toggle('fx-off', !on);
      if (store) { try { localStorage.setItem('ag-motion', on ? 'on' : 'off'); } catch (e) { /* ignore */ } }
      this.listeners.forEach((fn) => fn(on));
    },
    watch(fn) { this.listeners.push(fn); },
  };

  /* ---------- FX switch ---------- */

  function fxSwitch() {
    const btn = document.querySelector('[data-fx]');
    if (!btn) return;
    const label = btn.querySelector('[data-fx-state]');
    const paint = (on) => {
      label.textContent = on ? 'ON' : 'OFF';
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Screen effects on. Turn off motion' : 'Screen effects off. Turn on motion');
    };
    paint(fx.on);
    btn.addEventListener('click', () => fx.set(!fx.on));
    fx.watch(paint);

    // SMIL animations (the satellite) ignore CSS, so pause them directly
    const svgs = document.querySelectorAll('svg');
    const smil = (on) => svgs.forEach((s) => { if (s.pauseAnimations) on ? s.unpauseAnimations() : s.pauseAnimations(); });
    smil(fx.on);
    fx.watch(smil);
  }

  /* ---------- Boot sequence ---------- */

  function boot() {
    const el = document.getElementById('boot');
    let seen = false;
    try { seen = sessionStorage.getItem('ag-booted') === '1'; } catch (e) { /* storage blocked */ }
    // The power switch shows even with motion off: it is also the visitor's
    // choice about sound, and browsers only allow audio after a gesture.
    if (!el || seen) return;

    const log = el.querySelector('[data-boot-log]');
    const title = el.querySelector('[data-boot-title]');
    const gate = el.querySelector('[data-boot-gate]');
    const skip = el.querySelector('[data-boot-skip]');
    const lines = [
      'INCOMING FILE: GHATORA, AVIRAJ',
      'ORIGIN: EARTH',
      'DECRYPTING DOSSIER',
      'FILE OPEN',
    ];
    const timers = [];
    let started = false;
    let done = false;

    el.classList.add('is-on');
    document.body.classList.add('is-locked');
    gate.querySelector('[data-power="on"]').focus();

    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      try { sessionStorage.setItem('ag-booted', '1'); } catch (e) { /* ignore */ }
      el.classList.add('is-off');
      document.body.classList.remove('is-locked');
      setTimeout(() => el.remove(), 700);
      window.removeEventListener('keydown', finish);
      // The wanted page is on screen: audio.js brings the music in
      document.dispatchEvent(new CustomEvent('ag:boot-done'));
    };

    const power = (sound) => {
      if (started) return;
      started = true;
      window.removeEventListener('keydown', onKey);
      // Synchronous, so audio starts inside the visitor's gesture
      document.dispatchEvent(new CustomEvent('ag:power', { detail: { sound } }));
      gate.hidden = true;
      el.classList.add('is-powered');
      title.textContent = 'TUNING...';
      if (!fx.on) { finish(); return; }

      skip.hidden = false;
      skip.focus();
      lines.forEach((text, i) => {
        timers.push(setTimeout(() => {
          const li = document.createElement('li');
          li.textContent = text;
          log.appendChild(li);
          if (i === lines.length - 1) title.textContent = 'SIGNAL LOCKED';
        }, 900 + i * 420));
      });
      timers.push(setTimeout(finish, 900 + lines.length * 420 + 650));
      skip.addEventListener('click', finish);
      setTimeout(() => {
        el.addEventListener('click', finish);
        window.addEventListener('keydown', finish);
      }, 0);
    };

    const onKey = (e) => {
      if (['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return;
      // Enter/Space on a focused switch is that switch's own click
      if (e.target.closest('[data-power]') && (e.key === 'Enter' || e.key === ' ')) return;
      e.preventDefault();
      power(e.key !== 'Escape');
    };
    gate.querySelectorAll('[data-power]').forEach((btn) => {
      btn.addEventListener('click', () => power(btn.dataset.power === 'on'));
    });
    window.addEventListener('keydown', onKey);
  }

  /* ---------- Static: noise tile plus random interference bursts ---------- */

  const signal = { glitch: null };

  function staticNoise() {
    const crt = document.querySelector('.crt');
    const grain = crt && crt.querySelector('.crt__grain');
    const tear = crt && crt.querySelector('.crt__tear');
    if (!grain) return;

    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const url = `url(${c.toDataURL()})`;
    grain.style.backgroundImage = url;
    tear.style.backgroundImage = url;

    let timer = 0;
    const burst = () => {
      if (!fx.on || document.hidden) { schedule(); return; }
      const frames = 2 + ((Math.random() * 4) | 0);
      let n = 0;
      crt.classList.add('is-static');
      root.classList.add('is-jitter');
      const frame = () => {
        const y = Math.random() * 100;
        tear.style.transform = `translate3d(${(Math.random() - 0.5) * 40}px, ${y}vh, 0) scaleY(${0.5 + Math.random() * 2})`;
        root.style.setProperty('--jx', `${((Math.random() - 0.5) * 8).toFixed(1)}px`);
        signal.glitch = { y: y / 100, h: 0.04 + Math.random() * 0.12, dx: (Math.random() - 0.5) * 30 };
        n += 1;
        if (n < frames) timer = setTimeout(frame, 45 + Math.random() * 60);
        else timer = setTimeout(() => {
          crt.classList.remove('is-static');
          root.classList.remove('is-jitter');
          signal.glitch = null;
          schedule();
        }, 60);
      };
      frame();
    };
    // Mostly a clean picture; interference every 4 to 11 seconds
    const schedule = () => { timer = setTimeout(burst, 4000 + Math.random() * 7000); };
    schedule();
    fx.watch((on) => {
      if (on) return;
      clearTimeout(timer);
      crt.classList.remove('is-static');
      root.classList.remove('is-jitter');
      signal.glitch = null;
      schedule();
    });
  }

  /* ---------- Clocks ---------- */

  function clock() {
    const el = document.querySelector('[data-clock]');
    const chart = document.querySelector('[data-chart-clock]');
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const t0 = Date.now();
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      if (el) el.textContent = fmt.format(new Date());
      if (chart) {
        const s = Math.floor((Date.now() - t0) / 1000);
        chart.textContent = `T+${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Mobile menu ---------- */

  function menu() {
    const open = document.querySelector('[data-menu-open]');
    const overlay = document.getElementById('overlay');
    const close = overlay && overlay.querySelector('[data-menu-close]');
    if (!open || !overlay) return;

    const hide = (focusBack = true) => {
      overlay.hidden = true;
      overlay.classList.remove('is-open');
      open.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
      if (focusBack) open.focus();
    };

    open.addEventListener('click', () => {
      overlay.hidden = false;
      overlay.classList.add('is-open');
      open.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
      close.focus();
    });
    close.addEventListener('click', () => hide());
    overlay.addEventListener('click', (e) => { if (e.target.closest('a')) hide(false); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hide();
      if (e.key !== 'Tab') return;
      const items = overlay.querySelectorAll('button, a');
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- Current section in nav + side index ---------- */

  function currentSection() {
    const sections = document.querySelectorAll('[data-section]');
    const links = document.querySelectorAll('.index a, .bar__nav a');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.dataset.section;
        links.forEach((a) => {
          const match = a.getAttribute('href') === `#${id}`;
          a.classList.toggle('is-current', match);
          if (match) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  /* ---------- Reveal ---------- */

  function reveal() {
    const items = document.querySelectorAll('.reveal');
    const showAll = () => items.forEach((el) => el.classList.add('is-in'));
    if (!fx.on || !('IntersectionObserver' in window)) { showAll(); return; }
    // Stagger siblings that enter together
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty('--d', `${Math.min(n, 4) * 0.08}s`);
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
        n += 1;
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    items.forEach((el) => io.observe(el));
    fx.watch((on) => { if (!on) showAll(); });
  }

  /* ---------- Star-chart parallax ---------- */

  function parallax() {
    const layers = [...document.querySelectorAll('[data-parallax]')];
    if (!layers.length) return;
    const small = window.matchMedia('(max-width: 767px)');
    let ticking = false;
    const update = () => {
      const y = fx.on && !small.matches ? window.scrollY : 0;
      layers.forEach((el) => {
        if (y < window.innerHeight * 1.5) el.style.transform = `translate3d(0, ${y * parseFloat(el.dataset.parallax)}px, 0)`;
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    fx.watch(update);
  }

  /* ---------- Decode titles on hover/focus ---------- */

  function decode() {
    const glyphs = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789#/%';
    document.querySelectorAll('[data-decode]').forEach((el) => {
      const final = el.textContent;
      const host = el.closest('.file');
      let raf = 0;
      const run = () => {
        if (!fx.on) return;
        cancelAnimationFrame(raf);
        const start = performance.now();
        const dur = 520;
        el.classList.add('is-decoding');
        const step = (now) => {
          const p = Math.min((now - start) / dur, 1);
          const fixed = Math.floor(p * final.length);
          let out = final.slice(0, fixed);
          for (let i = fixed; i < final.length; i++) {
            out += final[i] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
          }
          el.textContent = out;
          if (p < 1) raf = requestAnimationFrame(step);
          else { el.textContent = final; el.classList.remove('is-decoding'); }
        };
        raf = requestAnimationFrame(step);
      };
      host.addEventListener('mouseenter', run);
      host.addEventListener('focusin', run);
    });
  }

  /* ---------- Copy email ---------- */

  function copy() {
    const status = document.querySelector('[data-copy-status]');
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const value = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(value);
          status.textContent = `> copied ${value} to clipboard`;
        } catch (e) {
          status.textContent = `> copy blocked. address: ${value}`;
        }
        setTimeout(() => { status.textContent = ''; }, 4000);
      });
    });
  }

  /* ---------- Phosphor dot-matrix name ---------- */

  function dots() {
    const canvas = document.querySelector('[data-dots]');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const amber = token('--amber');
    const cream = token('--cream');
    const red = token('--bebop-red');
    let points = [];
    let w = 0, h = 0, dpr = 1, cell = 6;
    const pointer = { x: -9999, y: -9999, active: false };
    let running = false;
    let visible = true;
    let lastFrame = 0;

    const layout = () => {
      const box = canvas.parentElement.getBoundingClientRect();
      const narrow = box.width < 700;
      const lines = narrow ? ['AVIRAJ', 'GHATORA'] : ['AVIRAJ GHATORA'];
      cell = narrow ? Math.max(4, Math.round(box.width / 80)) : Math.max(5, Math.round(box.width / 230));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Rasterise the name offscreen, then sample it into a grid of dots
      const off = document.createElement('canvas');
      const octx = off.getContext('2d');
      const fontPx = 200;
      octx.font = `700 ${fontPx}px Syncopate`;
      const textW = Math.max(...lines.map((l) => octx.measureText(l).width));
      const lineH = fontPx * 1.02;
      off.width = Math.ceil(textW);
      off.height = Math.ceil(lineH * lines.length);
      octx.font = `700 ${fontPx}px Syncopate`;
      octx.fillStyle = '#000';
      octx.textBaseline = 'top';
      lines.forEach((l, i) => octx.fillText(l, 0, i * lineH + fontPx * 0.06));

      const scale = box.width / off.width;
      w = box.width;
      h = Math.ceil(off.height * scale);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const step = cell / scale;
      points = [];
      for (let y = step / 2; y < off.height; y += step) {
        for (let x = step / 2; x < off.width; x += step) {
          const a = data[((y | 0) * off.width + (x | 0)) * 4 + 3];
          if (a > 128) {
            points.push({ hx: x * scale, hy: y * scale, x: x * scale, y: y * scale, seed: Math.random() });
          }
        }
      }
    };

    const draw = (t) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const size = Math.max(2, cell * 0.62);
      const radius = cell * 14;
      // Interference shears a band of rows sideways
      const g = fx.on ? signal.glitch : null;
      const gy0 = g ? g.y * h : 0;
      const gy1 = g ? gy0 + g.h * h : 0;

      for (const p of points) {
        let tx = p.hx, ty = p.hy, hot = 0;
        if (pointer.active) {
          const dx = p.hx - pointer.x, dy = p.hy - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < radius) {
            const f = (1 - d / radius) ** 2;
            tx += (dx / (d || 1)) * f * cell * 3;
            ty += (dy / (d || 1)) * f * cell * 3;
            hot = f;
          }
        }
        p.x += (tx - p.x) * (fx.on ? 0.18 : 1);
        p.y += (ty - p.y) * (fx.on ? 0.18 : 1);
        const sheared = g && p.y > gy0 && p.y < gy1;

        // Phosphor shimmer: a few dots dip at any moment
        const flick = fx.on ? 0.72 + 0.28 * Math.sin(t * 0.002 + p.seed * 40) : 1;
        ctx.globalAlpha = Math.min(1, flick + hot);
        ctx.fillStyle = sheared || hot > 0.55 ? cream : hot > 0.2 ? red : amber;
        ctx.fillRect(p.x - size / 2 + (sheared ? g.dx : 0), p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t) => {
      if (!visible || !fx.on) { running = false; draw(t); return; }
      // ~30fps is plenty for phosphor shimmer
      if (t - lastFrame > 32) { draw(t); lastFrame = t; }
      requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || !fx.on) return;
      running = true;
      requestAnimationFrame(loop);
    };

    const init = () => {
      layout();
      root.classList.add('dots-ready');
      draw(0);
      start();
    };

    const fontReady = document.fonts && document.fonts.load
      ? document.fonts.load('700 200px Syncopate')
      : Promise.resolve();
    fontReady.then(init, init);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { layout(); draw(performance.now()); }, 150);
    });

    canvas.parentElement.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
      if (!fx.on) draw(0);
    });
    canvas.parentElement.addEventListener('pointerleave', () => {
      pointer.active = false;
      if (!fx.on) draw(0);
    });

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    }).observe(canvas);
    fx.watch((on) => { if (on) start(); else draw(0); });
  }

  fxSwitch();
  boot();
  staticNoise();
  clock();
  menu();
  currentSection();
  reveal();
  parallax();
  decode();
  copy();
  dots();
})();
