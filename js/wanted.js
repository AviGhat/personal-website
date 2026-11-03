(() => {
  'use strict';

  const root = document.documentElement;
  const motion = () => root.classList.contains('fx-on');

  /* ---------- Keys ---------- */

  function keys() {
    const status = document.querySelector('[data-status]');
    const list = [...document.querySelectorAll('.key[data-key]')];
    if (!status || !list.length) return;
    let typing = 0;

    // Touch screens have no hotkeys to mention
    if (window.matchMedia('(hover: none)').matches) status.textContent = '> tap a key';

    // Type a status line out like a terminal readout
    const say = (text) => {
      clearInterval(typing);
      if (!motion()) { status.textContent = text; return; }
      let i = 0;
      status.textContent = '';
      typing = setInterval(() => {
        i += 2;
        status.textContent = text.slice(0, i);
        if (i >= text.length) clearInterval(typing);
      }, 16);
    };

    const label = (key) => key.querySelector('.key__label').textContent.trim().toUpperCase();

    list.forEach((key) => {
      key.addEventListener('click', (e) => {
        const href = key.getAttribute('href');
        const leaves = key.target === '_blank' || href.startsWith('mailto:');
        say(leaves ? `> opening channel: ${label(key)}` : `> loading ${label(key)} ...`);

        // New tabs, mail and modified clicks behave normally; page links
        // wait just long enough to see the key go down.
        if (leaves || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !motion()) return;
        e.preventDefault();
        key.classList.add('is-pressed');
        setTimeout(() => { window.location.href = href; }, 380);
      });
      key.addEventListener('mouseenter', () => say(`> ${label(key)} [${key.dataset.key}]`));
    });

    // Hotkeys: each key's letter presses it
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (document.body.classList.contains('is-locked')) return; // boot screen is up
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const key = list.find((k) => k.dataset.key === e.key.toUpperCase());
      if (!key) return;
      e.preventDefault();
      key.focus();
      key.click();
    });

    // Keys restored from the back/forward cache should not stay down
    window.addEventListener('pageshow', () => list.forEach((k) => k.classList.remove('is-pressed')));
  }

  /* ---------- Portrait: the photo re-set as amber halftone ---------- */

  function halftone() {
    const canvas = document.querySelector('[data-halftone]');
    const img = document.querySelector('.mug__photo');
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    const css = getComputedStyle(root);
    const amber = css.getPropertyValue('--amber').trim();
    const red = css.getPropertyValue('--misreg-red').trim();

    const render = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Sample the photo the way object-fit: cover lays it out (focus near the face)
      const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      const dx = (box.width - dw) / 2, dy = (box.height - dh) * 0.3;
      const off = document.createElement('canvas');
      off.width = Math.round(box.width); off.height = Math.round(box.height);
      const o = off.getContext('2d', { willReadFrequently: true });
      o.drawImage(img, dx, dy, dw, dh);
      const data = o.getImageData(0, 0, off.width, off.height).data;

      const step = Math.max(5, Math.round(box.width / 70));
      ctx.clearRect(0, 0, box.width, box.height);
      const dots = [];
      for (let y = step / 2; y < box.height; y += step) {
        for (let x = step / 2; x < box.width; x += step) {
          const k = ((y | 0) * off.width + (x | 0)) * 4;
          const lum = (0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2]) / 255;
          const r = Math.pow(lum, 1.15) * step * 0.62;
          if (r > 0.35) dots.push([x, y, r]);
        }
      }
      // Red plate a hair off register, amber plate on top
      ctx.fillStyle = red;
      for (const [x, y, r] of dots) { ctx.beginPath(); ctx.arc(x + 2, y, r, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = amber;
      for (const [x, y, r] of dots) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
      root.classList.add('halftone-ready');
    };

    // Tap, click, Enter or Space switches between halftone and photo
    const mug = canvas.closest('.mug');
    const flip = () => mug.classList.toggle('is-revealed');
    mug.addEventListener('click', flip);
    mug.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });

    if (img.complete && img.naturalWidth) render();
    else img.addEventListener('load', render, { once: true });
    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(render, 200); });
  }

  keys();
  halftone();
})();
