# Design: AG-TRN amber phosphor terminal

The site is a recovered bounty terminal from a 90s space-western ship. All tokens live in `css/style.css` `:root`; never hard-code colours elsewhere.

## Colour
- Ground `--space-black` #0B0B0D, panels `--soot` #17171A, rules `--rule` #3A3A3F.
- Text `--cream` #F1E6CC, secondary `--ink-dim` #B8AE96 (AA on black).
- Dominant accent: `--amber` #F0A81F (phosphor). `--bebop-red` #E5432B for stamps, CTA border, contact console. `--teal` #1E8C87 for one bounty file only. `--neon` #7CF27A for status lamps and cursors only.
- One cream "paper" section (Missions) with `--paper-ink` text and `--paper-red` height-chart rules.
- No purple, no soft gradients. Allowed patterns: scanlines, height-chart rules, halftone dots.

## Type
- Display: Syncopate 700, uppercase, wide; headings get a 1.5px red/green misregistration shadow (no blur).
- Mono: Share Tech Mono for body, labels, terminal readouts.
- CRT: VT323 for boot text, file codes, ruler numerals.
- Labels: 0.75rem uppercase, 0.14–0.18em tracking.

## Components
- **Status bar**: fixed, 1px bottom rule, mono tokens; hover inverts to amber.
- **Slate**: a full-width strip at the top of each section with the S/0x session number. Section headings carry no eyebrow above them.
- **Bounty file**: hairline frame, registration ticks at two corners, halftone emblem panel, VT323 code. When idle the emblem sits out of register; on hover or focus it lines up and the title decodes.
- **Placard**: a dark block on cream with a red number tab; on desktop the placards stand at staggered heights like a lineup.
- **Rack**: identical inventory columns in one bordered row; slots invert on hover.
- **Console**: red-bordered terminal; commands are links, plus a copy button.
- **Redaction (`.todo`)**: a dark bar marking missing content. Replace it with real text; never delete the bar and leave the gap empty.

## Home page (index.html): the wanted console
- Layout follows the Asimov bounty screen, recoloured warm: key rail left, portrait centre, file data right, status line along the bottom. Panel tokens: `--panel`, `--panel-hi`, `--panel-edge`, `--led-off`.
- **Keys**: chamfered hardware buttons with a lamp and a hotkey cap. Hover or focus inverts them to amber, and clicking presses them down before the page changes. The keyboard letter triggers the key. Focus thickens the key's edge, because clip-path swallows outlines.
- **Portrait**: the photo re-drawn as an amber halftone on canvas, with a red plate slightly off register. Hover, tap, Enter or Space reveals the tinted photo underneath.
- **Space** (`js/space.js`): a canvas starfield (drift, twinkle, an occasional shooting star) and a procedural Earth rendered per pixel from a lookup table. Rotation 150s, clouds 105s, sun upper right, thin atmosphere on the lit edge. Earth colours are tokens `--earth-*` and `--atmo`. The planet sits left on desktop (the console moves right) and rises top-right on tablets and phones.
- The home panel uses the `.deck` class so it never collides with the contact `.console` on the portfolio page.

## Sound (`js/audio.js`)
- Sound is opt-in. The boot screen is a power switch: "Power on" (any key) enables sound, "Silent" (Esc) doesn't. Browsers only allow audio after a gesture, so this is also what unlocks it. The SND panel in the top bar has the on/off switch and the volume fader.
- Effects are synthesised with Web Audio, so no files: the hover buzz (a 120Hz hum plus a crackle of static, on links, buttons, keys and inputs) and the power-on (relay thunk, static burst, degauss wobble, a flyback whine sweeping up to about 12kHz then fading).
- Boot screen: standby static hisses until the visitor chooses. It plays at once where the browser allows autoplay; otherwise it starts on the first press and hands straight over to the power-on.
- Music: `assets/audio/road-to-the-west.mp3`, looping at half the master volume. It starts only after this session's power-on, when the boot finishes (event `ag:boot-done`), and never on a fresh visit by itself. Its position is kept in sessionStorage, so it carries on across pages. The sound on/off choice and the volume persist in localStorage.
- Clicks on links, keys and buttons play a quieter "zap" (relay click, static snap, a brief whine) than the power-on.

## Portfolio space dressing
- A fixed starfield (`.space--page`) sits behind every dark section. The dark sections use `--section-veil` instead of solid soot, and panels over the stars use `--panel-veil`.
- Bounty board: pixel meteors on a canvas at a third of screen resolution (`image-rendering: pixelated`). They enter from the top or right of the visible slice, with stepped amber-to-red trails.
- Open a Channel: an original red racer (`.flyby`, inline SVG). It crosses every 7–16s in the open band under the console, mostly left to right, with a flickering exhaust. It is hidden with motion off.
- Glare: the sun sits just past the upper edge of the Earth that's on screen. A starburst, an anamorphic streak and lens ghosts are drawn on `.space__glare` (screen blend), and the oceans get a specular glint.

## Motion
Boot sequence (first visit per session), dot-matrix name that reacts to the pointer, staggered reveals, a scanline flicker, a rolling band, film grain. FX is on by default for everyone, whatever the OS motion setting (the owner's choice); the FX switch in the top bar turns all of it off and is remembered. Without JS, `prefers-reduced-motion` still disables animation.

## Hobbies page (hobbies.html): the lounge
- Three.js r160 from jsDelivr through an import map; everything in the scene is built in code (`js/hobbies.js`), with no model files. It's an original ship's lounge: yellow couches, a deck plate, stairs to a landing with an orange rail, a bulkhead door, a console bank, and warm strip light.
- Four CRTs (pale teal-grey shell `--crt-shell`, faceted tube housing, slightly bulged glass). Each screen is a live canvas: music EQ bars (amber), esports radar (green), reading pages (cream), and a ball crossing a pitch (red; soccer then tennis).
- Interaction: drag to look around, hover a monitor to buzz and light it, click or press a channel button to fly the camera in (1.1s) and open the `.tv` terminal. The terminal is translucent `--tv-glass` with scanlines and powers on like a tube. Esc, Close or a click on empty space flies back. On wide screens the monitor sits left with the terminal right; on phones the terminal docks at the bottom.
- The hobby copy is real HTML (`.hobby` articles), so it's readable without WebGL (`.no-webgl` falls back to a plain list). Specifics still to fill are marked `.todo`.
- Set dressing lives in `js/lounge-world.js`:
  - Hull: metallic materials with RoomEnvironment reflections; a riveted viewport in the back wall with a real 3D Earth (turning surface and cloud layer, its own sun) and a starfield, plus a cool light shaft falling in through it.
  - Floor: plates in two tones, grated side strips, hazard edging, and two woven rugs.
  - Cozy props: a gaming corner (desk, two live screens, lit keyboard, PC tower, chair, headphones); a bed with a striped blanket and pillows; a coffee table with a steaming mug; a floor lamp, a hanging lantern and a bedside lamp; a wall terminal; a gig poster; a bulkhead door; cargo.
  - A ceiling fan light: spinning blades, a soft additive light cone and a cool spotlight.
  - The ship's corgi: original low-poly, lying beside food and water bowls. It breathes, wags, looks around and twitches its ears; a click makes it happy for a few seconds.
- On phones the decorative point lights are skipped (the glowing bulbs carry the look) and shadows are off.
