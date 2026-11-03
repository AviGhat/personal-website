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
  - Hull: metallic materials with RoomEnvironment reflections. A riveted viewport sits in the left wall over the gaming corner; through it, hyperspace streaks slide past, and a cool light shaft falls in.
  - Floor: plates in two tones, grated side strips, hazard edging, and two woven rugs.
  - Cozy props: a gaming corner (desk, two live screens, lit keyboard, PC tower, chair, headphones); a bed with a striped blanket and pillows; a coffee table with a steaming mug; a floor lamp, a hanging lantern and a bedside lamp; a wall terminal; a gig poster; a bulkhead door; cargo.
  - A ceiling fan light: spinning blades, a soft additive light cone and a cool spotlight.
  - The ship's corgi: original low-poly, lying beside food and water bowls. It breathes, wags, looks around and twitches its ears; a click makes it happy for a few seconds.
- **Arcade cabinet** (`js/arcade.js`): an original upright against the back wall, left of the stairs. Red side panels with ROAD side art, a lit marquee, an amber trim line, a joystick and six lit buttons, and a coin door with two red slots. The marquee reads ROAD FIGHTER. Its screen shows the game's title card when idle and copies the live match while someone plays; the stick waggles during play. Click it (or **CH 05 Arcade**) and the camera walks up to it while the game opens in a red-bordered panel. On phones the lounge's six buttons stack in two rows of three, and every docked panel sits above them (`--chbar`).
- **Road Fighter** (`js/fighter.js`): the cabinet's original fighting game, drawn in code at 320x180 and scaled up with square pixels. It's set on a night dock with a half-set planet, gantries and a DOCK 9 neon sign.
  - Three original fighters:
    - **Vesper**: a ninja in a purple hood and gi, purple at the owner's request and for her only, with a red scarf. Fast and light. Specials: SHURIKEN (↓↘→ P), a spinning star thrown low and fast; VANISH (↓↙← P), she disappears in smoke and reappears behind the opponent.
    - **Rio Vega**: a Wing Chun bounty hunter in a teal jacket with a cream collar, hands held up the centre line. Specials: CHAIN PUNCH (↓↘→ P), a rapid multi-hit advance; STICKY HANDS (↓↙← P), a parry that catches a strike or projectile and answers with a palm strike.
    - **Ben**: a karate fighter in a red gi, dark hair tied back and a gold headband. Specials: SUN BOLT (↓↘→ P), a projectile; CYCLONE KICK (↓↙← K), a travelling spin kick that hits on both sides.
  - Motion inputs are read in numpad notation relative to facing; the diagonal is optional. L / SP is a shortcut for the first special, or the second when holding back. One projectile per fighter at a time, and projectiles that meet cancel out. A special's name flashes under the health bar.
  - **Supers** (↓↘→↓↘→ P, or down + L), each paid for with a full super meter: Vesper's NIGHT STORM (a fan of five shuriken), Rio's STRAIGHT BLAST (a long chain punch ending in a knockdown palm), and Ben's SOLAR FLARE (a huge, slow sun bolt that hits five times and eats normal projectiles one hit at a time). A super starts with a freeze-frame: a cream flash, the screen darkens, the user stays lit, and a red banner slides in with the move's name, with a charge-and-boom sound (`fx('super')`).
  - **Meter**: the teal bar along the bottom. It fills when you land hits (most), get blocked or use a special, and a little when you take hits. It carries over between rounds and flashes SUPER MAX when full.
  - **Cancels**: a punch, kick or sweep that connects (hit or block) can cancel into a special or the super during its active frames and a few frames after, e.g. Ben's punch into Cyclone Kick. A special that connects can cancel into the super.
  - **Combos**: hits landed while the defender is still reeling count as one combo, shown as "N HITS / COMBO" on the attacker's side. Each extra hit does 10% less, down to 40%. Directions keep being read through hit-stop and super flashes, so motions can be buffered.
  - **Dashes**: forward, neutral, forward within 12 ticks dashes in; back, neutral, back hops out, with a few frames of invulnerability. A tap that rolls straight out of a quarter circle doesn't count, so it can't turn a special into a dash.
  - The CPU also dashes, sometimes confirms a landed normal into a special, and spends a full meter on its super.
  - One player against a random CPU opponent, best of three, 60-second rounds: title, character select (with each fighter's move list), ROUND / FIGHT, K.O. or TIME, YOU WIN or YOU LOSE.
  - Normals: punch, kick, crouching sweep (low), one jump attack. Holding away blocks; lows need a crouch, jump-ins need a stand. Hits add hit-stop, sparks and a little shake.
  - The CPU reacts after a short delay and uses each fighter's specials: it zones with projectiles, vanishes or parries threats, and rushes in with chain punches or spin kicks.
  - Controls: arrows or WASD, J punch, K kick, L special shortcut, Enter start. Touch screens get a d-pad and P / K / SP / Start buttons in place of the key list. Sounds come from `agSound.fx`.
  - Fighter colours are tokens `--fx-*`.
- On phones the decorative point lights are skipped (the glowing bulbs carry the look) and shadows are off.
- **Hyperspace** (`js/cockpit.js`, `buildHyperspace`): a single instanced field of amber, cream, green and cyan streaks flying toward +z (the ship heads -z). It is dense around the cockpit axis for a tunnel ahead, with a band along the left flank for the lounge viewport. Streaks that would cross the ship stop short of it, and a white-hot glow sits at the vanishing point.
- **Cockpit door:** at the top of the stairs, two panels slide into the back wall (with the `slide` sound) and a status lamp turns red to green. An invisible pad over the doorway makes it easy to click; the **Cockpit** button in the bar does the same.
- **Cockpit** (`buildCockpit`):
  - Styled after the grey-blue shuttle reference: panelled walls with angled ceiling panels, a ceiling light panel, blue floor strips down the aisle, crew seats along both walls, and portholes showing passing streaks.
  - Two pilot seats face a sloped console: a radar sweeping the eight planets on their orbits, a status screen, blinking lit buttons (and the occasional `beep`), and a flight stick.
  - The nose is a faceted glass canopy (top and side panes, each side split in two) tapering to a point below deck level, so the belly falls away and the view reaches down.
  - Earth is a whole planet seen from high orbit (radius 200, about 760 out), low and to the left through the canopy, with its upper limb just clearing the console. It has an atmosphere rim and turns slowly, with clouds drifting faster than the ground.
  - The back wall (seen when you turn round) carries original Bebop-style posters (a WANTED bounty bill, a BOP/SWING gig poster with a saxophone, a SESSION 27 title card), a JAZZ & BLUES neon over the door, a red guitar, framed records, a turntable whose record spins, a shelf of cassettes, and floor speakers.
- The lounge is sealed: its ceiling (with light strips) and front wall face inward only, so the desktop cutaway camera still sees in from outside, while every view from inside (the walk down, the cockpit door) shows a closed room. On phones the lounge camera stands inside the room by the ceiling, so nothing beyond the walls is ever in frame.
  - In the seat you can drag to look around a full 360°, with a little pointer sway on top. Your own seat hides when you turn to face the cabin.
- **Console layout**, left to right on the sloped panel: headphones, tape deck, radar, status screen and throttle, with a block of lit keys behind the throttle. The pilot file monitor stands on the console's back ledge, behind everything on the panel, so it never hides a control. The seat looks a little right of straight ahead so the status screen and throttle are in view.
- **Throttle**: a red-gripped lever in a slotted quadrant with amber detent ticks. Drag it down (toward you) to speed up and up to ease off. The **Throttle** slider in the bridge bar, and the up/down arrow keys (or W/S) while seated, do the same; each quarter detent clicks (`beep`). It sets `buildHyperspace().setThrust`: streak speed runs from 0.25x (idle) to 2.75x (full burn), the streaks stretch as they speed up, and the drive spools rather than jumping. The status screen follows it: the header reads IDLE, ENGAGED or FULL BURN with a percentage, DRIVE shows the thrust, the shield thins and comms get noisier as speed builds. Cruise (30%) is the speed the scene was tuned at.
- **Console bodies** follow their tilted tops (`consoleBody` extrudes a wedge profile), so the panels, deck, radar and monitor sit on the dash instead of sinking into it.
- **Tape deck** (`js/tape.js`, built in `buildCockpit`): a cassette deck on the console, left of the radar, in the same pale shell as the lounge CRTs. It holds a hand-labelled mix tape, piano keys, a level meter, a run lamp and a cyan projector lens. A pair of headphones lies to its left; the cable trails over to the deck and the jack lies just short of its empty PHONES socket.
  - Clicking the deck (or **Music** in the bar) leans the camera in and projects a holographic player. It is dark teal glass with cyan line work, scanlines, corner brackets, a rolling interference band, an occasional flicker, and a red/cyan split on the title. Hard edges only; no glow. The panel projects straight up: the camera leans in with the deck low in the frame, and each frame JS centres the panel over the deck and stands it just above the deck's back edge, sized to the space up to the top bar. It rises out of the beam, a sliver at its lower edge widening and then climbing. A dashed beam (`.holo-beam` SVG) fans up from the lens to the panel's lower edge. This works the same way on every screen size.
  - The controls are ours: prev (restarts the track first), play/pause, next, shuffle, a seekable segmented progress bar, and the next two tracks. Underneath, Spotify's embed plays through its iFrame API (play, pause, resume, seek and load only: Spotify gives a page no volume control, so the embed plays at the device volume), which loads only when the deck is first opened. The Spotify embed stays in the panel. Visitors signed in to Spotify hear full tracks; everyone else gets 30-second previews. When a track ends (the embed parks at the end), the deck rolls on to the next one.
  - The queue comes from `assets/data/playlist.json`, a snapshot of the playlist "It Just is...". Run `node scripts/spotify-playlist.mjs` after editing the playlist.
  - While Spotify plays, the site loop steps aside (`agSound.hold`) and returns 1.5s after Spotify pauses. Closing the panel or walking down to the lounge keeps the tape running; the reels turn and the meter jumps.
- **Decks:** `lounge`, `transit` and `cockpit` are set as `data-mode` on `.lounge`, and CSS swaps the intro and button bar for each.
  - The camera walks a CatmullRom path up the stairs, through the door and into the first-person seat; in the seat, the pointer turns your head.
  - The console monitor (or **About me**) opens terminal 5, the pilot file. Esc closes it; a second Esc walks back down and the door shuts behind you.
  - `hobbies.html#cockpit` opens straight into the seat.
