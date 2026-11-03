/* ==========================================================
   The cockpit tape deck: a holographic player for the Spotify
   playlist. Our own controls drive Spotify's embed through its
   iFrame API; the queue comes from assets/data/playlist.json
   (refresh it with scripts/spotify-playlist.mjs). The embed loads
   only when the deck is first opened.
   ========================================================== */

const API = 'https://open.spotify.com/embed/iframe-api/v1';

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const hold = (on) => { try { if (window.agSound && window.agSound.hold) window.agSound.hold(on); } catch (e) { /* ignore */ } };

export function createTape(root) {
  const $ = (sel) => root.querySelector(sel);
  const ui = {
    no: $('[data-holo-no]'), title: $('[data-holo-title]'), artist: $('[data-holo-artist]'),
    pos: $('[data-holo-pos]'), dur: $('[data-holo-dur]'), bar: $('[data-holo-bar]'), fill: $('[data-holo-fill]'),
    play: $('[data-holo-play]'), prev: $('[data-holo-prev]'), next: $('[data-holo-next]'),
    shuffle: $('[data-holo-shuffle]'), queue: $('[data-holo-queue]'), embed: $('[data-holo-embed]'),
    status: $('[data-holo-status]'), beam: document.querySelector('[data-holo-beam]'),
  };
  const beamShape = ui.beam && ui.beam.querySelector('polygon');
  const beamRays = ui.beam ? [...ui.beam.querySelectorAll('line')] : [];

  let tracks = [];
  let order = [];       // play order: indexes into tracks
  let at = 0;           // position in order
  let ctrl = null;      // Spotify EmbedController
  let loading = null;
  let paused = true;
  let wantPlay = false; // pressed play before the embed was ready
  let loadedUri = '';
  let pos = 0, dur = 0;
  let releaseTimer = 0;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn(!paused));

  const ready = fetch('assets/data/playlist.json')
    .then((r) => r.json())
    .then((data) => {
      tracks = data.tracks;
      order = tracks.map((_, i) => i);
      paint();
    })
    .catch(() => { ui.status.textContent = 'Tape jammed: the playlist would not load.'; });

  const track = () => tracks[order[at]];

  function paint() {
    const t = track();
    if (!t) return;
    ui.no.textContent = `TRK ${String(order[at] + 1).padStart(2, '0')} / ${tracks.length}`;
    ui.title.textContent = t.title;
    ui.artist.textContent = t.artist;
    const d = loadedUri === t.uri && dur ? dur : t.ms;
    ui.dur.textContent = fmt(d);
    ui.pos.textContent = fmt(loadedUri === t.uri ? pos : 0);
    const p = loadedUri === t.uri && d ? Math.min(1, pos / d) : 0;
    ui.fill.style.transform = `scaleX(${p})`;
    ui.bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    ui.play.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    ui.play.classList.toggle('is-playing', !paused);
    root.classList.toggle('is-playing', !paused);
    paintQueue();
  }

  function paintQueue() {
    const next = [];
    for (let k = 1; k <= 2 && k < order.length; k++) next.push((at + k) % order.length);
    ui.queue.replaceChildren(...next.map((n) => {
      const t = tracks[order[n]];
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'holo__cue';
      b.innerHTML = '<span class="holo__cue-no"></span><span class="holo__cue-title"></span><span class="holo__cue-artist"></span>';
      b.children[0].textContent = String(order[n] + 1).padStart(2, '0');
      b.children[1].textContent = t.title;
      b.children[2].textContent = t.artist;
      b.addEventListener('click', () => { at = n; play(); });
      li.append(b);
      return li;
    }));
  }

  // Load Spotify's iFrame API once, then make one controller for the session
  function embed() {
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        const t = track();
        IFrameAPI.createController(ui.embed, { uri: t.uri, width: '100%', height: 80 }, (c) => {
          ctrl = c;
          loadedUri = t.uri;
          c.addListener('playback_update', onUpdate);
          c.addListener('ready', () => { if (wantPlay) { wantPlay = false; c.play(); } });
          resolve(c);
        });
      };
      const s = document.createElement('script');
      s.src = API;
      s.async = true;
      s.onerror = () => { ui.status.textContent = 'No signal from Spotify. Try the link below.'; reject(new Error('spotify api')); };
      document.head.append(s);
    });
    return loading;
  }

  let nearEnd = false;
  function onUpdate(e) {
    const d = e.data || {};
    if (d.playingURI && d.playingURI !== loadedUri) return;   // the last track, still reporting
    const wasPaused = paused;
    pos = d.position || 0;
    dur = d.duration || 0;
    paused = !!d.isPaused;
    // Track over (a full song, or the 30-second preview). Updates come about once a
    // second, and the embed either parks at the end or stops and rewinds: roll on either way
    if (dur && pos >= dur - 1500) nearEnd = true;
    if (nearEnd && !d.isBuffering && (pos >= dur - 50 || (paused && pos < 1000))) {
      nearEnd = false;
      at = (at + 1) % order.length;
      play();
      return;
    }
    if (paused !== wasPaused) {
      clearTimeout(releaseTimer);
      if (!paused) hold(true);
      else releaseTimer = setTimeout(() => { if (paused) hold(false); }, 1500);   // a gap between tracks shouldn't bring the loop back
      emit();
    }
    paint();
  }

  async function play() {
    await ready;
    const t = track();
    if (!t) return;
    paused = false; pos = 0; dur = 0; nearEnd = false;
    hold(true);
    paint();
    emit();
    if (!ctrl) { wantPlay = true; embed().catch(() => {}); return; }
    if (loadedUri !== t.uri) {
      loadedUri = t.uri;
      ctrl.loadUri(t.uri);
      wantPlay = true;   // play once the new track is ready
      setTimeout(() => { if (wantPlay) { wantPlay = false; ctrl.play(); } }, 600);
    } else {
      ctrl.resume();
    }
  }
  function pause() {
    if (ctrl) ctrl.pause();
    paused = true;
    paint();
    emit();
  }
  function step(dir) {
    if (!order.length) return;
    at = (at + dir + order.length) % order.length;
    if (paused) { paint(); return; }
    play();
  }

  ui.play.addEventListener('click', () => (paused ? play() : pause()));
  ui.prev.addEventListener('click', () => {
    // Like a real deck: back to the top first, then the previous song
    if (ctrl && !paused && pos > 4000 && loadedUri === track().uri) { ctrl.seek(0); return; }
    step(-1);
  });
  ui.next.addEventListener('click', () => step(1));
  ui.shuffle.addEventListener('click', () => {
    const on = ui.shuffle.getAttribute('aria-pressed') !== 'true';
    ui.shuffle.setAttribute('aria-pressed', String(on));
    const cur = order[at];
    order = tracks.map((_, i) => i).filter((i) => i !== cur);
    if (on) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    else order = tracks.map((_, i) => i);
    if (on) order.unshift(cur);
    at = order.indexOf(cur);
    paint();
  });
  ui.bar.addEventListener('click', (e) => {
    if (!ctrl || loadedUri !== track().uri || !dur) return;
    const r = ui.bar.getBoundingClientRect();
    ctrl.seek(((e.clientX - r.left) / r.width) * dur / 1000);
  });

  return {
    show() {
      root.hidden = false;
      root.classList.remove('is-open');
      void root.offsetWidth;
      root.classList.add('is-open');
      if (ui.beam) ui.beam.removeAttribute('hidden');   // an SVG has no .hidden property
      embed().catch(() => {});
      ready.then(paint);
      root.focus({ preventScroll: true });
    },
    hide() {
      // Hidden, not removed: the embed keeps playing while you look around
      root.hidden = true;
      root.classList.remove('is-open');
      if (ui.beam) ui.beam.setAttribute('hidden', '');
    },
    // Project the panel straight up out of the deck: centred on the deck (cx) and
    // standing above its top edge (top), with the beam fanning up from the lens (x, y)
    beam(x, y, cx, top) {
      if (root.hidden) return;
      const box = root.offsetParent ? root.offsetParent.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
      const bar = document.querySelector('.bar');
      const ceiling = (bar ? bar.getBoundingClientRect().bottom : 0) + 12;
      const gap = 14;   // the visible run of beam between lens and panel
      const w = root.offsetWidth;
      const left = Math.min(Math.max(cx - w / 2, box.left + 16), box.left + box.width - 16 - w);
      root.style.left = `${left - box.left}px`;
      root.style.bottom = `${box.top + box.height - (top - gap)}px`;
      root.style.maxHeight = `${Math.max(220, top - gap - ceiling)}px`;
      if (!beamShape) return;
      const r = root.getBoundingClientRect();
      const b = r.bottom - 1;
      beamShape.setAttribute('points', `${x},${y} ${r.left},${b} ${r.right},${b}`);
      beamRays.forEach((l, k) => {
        const tx = r.left + (r.width * k) / (beamRays.length - 1);
        l.setAttribute('x1', x); l.setAttribute('y1', y); l.setAttribute('x2', tx); l.setAttribute('y2', b);
      });
    },
    onChange(fn) { listeners.push(fn); },
  };
}
