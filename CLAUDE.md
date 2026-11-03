# CLAUDE.md — Retro Space / Cowboy Bebop Personal Website

This file is the standing brief for every design and code decision in this project. Read it fully before touching anything. Follow it on every task, not just the first one.

---

## 1. Vision

A personal website that feels like a title card from a 90s space-western anime: jazz-era cool, worn-in, analog, a little melancholy, deeply stylish. Think Cowboy Bebop session posters, retro-futurist control panels, bounty-hunter terminals, CRT glow, film grain, bold flat colour fields, and confident typography.

It should feel **designed by a person with taste**, not generated. Every page should have a point of view.

Keywords: retro-futurism, jazz, bounty board, analog terminal, mission log, star charts, halftone, print poster, cassette-era hardware, noir space.

---

## 2. Hard rules (non-negotiable)

1. **Never produce a "vibe coded" looking website.** See section 3 for exactly what that means.
2. **Avoid purple entirely.** No purple, violet, indigo, lavender, or magenta-leaning blue. No purple or multi-colour gradients as backgrounds, glows, text fills, buttons, or borders. Only use purple if the user explicitly asks for it in a specific place.
3. **Always use a retro space / cyberpunk display font** (section 5). Never ship a page in a default or generic sans-serif.
4. **Always optimize for both desktop and mobile.** Design mobile and desktop deliberately, not as an afterthought (section 8).
5. **Always follow design references the user provides** (section 9).
6. **Always verify your work after finishing** (section 10). Never report "done" without having checked it.

---

## 3. The anti-vibe-code checklist

"Vibe coded" sites share a recognisable look. The reference screenshots the user supplied (Builder.io hero, Dreamlit landing page, "VibeCoding" page, Fine landing page) all show it. **Do not reproduce any of these patterns:**

**Colour and effects**
- Purple / violet / indigo gradients or radial glows on a near-black navy background
- Soft blurry gradient "orbs" or aurora blobs behind the hero
- Glowing text, glowing buttons, glowing borders
- Glassmorphism cards (frosted translucent panels with faint borders)
- Floating dust particles / scattered sparkle dots as "space" decoration

**Typography**
- Inter, Poppins, Roboto, Open Sans, Arial, or system-ui as the main font
- Giant centred bold sans headline with the second line in a gradient or lighter weight
- Everything centred, everything the same weight and size rhythm

**Layout and components**
- Centred hero, small pill badge above the headline ("✨ Introducing…", "New: …"), subhead, then two pill buttons (one white/filled, one ghost)
- Rows of identical rounded cards, each with a small icon tile, a title, two lines of grey text, and a row of tag chips
- Logo marquee strip of "trusted by" brands
- Three-column feature grid, pricing cards with a "Most Popular" badge, FAQ accordion, and a giant footer CTA, in that order
- Sparkle, wand, rocket, or arrow-in-circle icons used as decoration
- Generic dark mode with grey body text on near-black

**Copy**
- Buzzwords and filler ("supercharge", "seamless", "unlock", "revolutionize", "the future of…")
- Placeholder-sounding stats ("25% faster", "95% better")
- Emoji used as icons or section markers

**Process smells**
- Default Tailwind/shadcn look with no customisation
- Lorem ipsum or obviously generic placeholder text left in
- Every section built from the same card component

**Instead, do this:**
- Commit to a distinctive layout per page: asymmetry, strong grid, big type, overlap, deliberate negative space, offset blocks, rules and borders like a printed poster or instrument panel.
- Use flat colour fields, hard edges, thick rules, stencil/mono labels, halftone or grain texture, and real structure (numbered sections, "Episode / Session / Mission" labelling, timestamps, coordinates).
- Write copy in a voice: dry, cool, a little noir. The site is about a real person; use their real details. If details are missing, ask or leave a clearly marked TODO, never invent filler.
- Vary section treatments. Not every section should look like the last one.

Before finishing any page, run this self-test: *"If I squint, could this be a landing page for an AI SaaS tool?"* If yes, redesign it.

---

## 4. Colour

Palette is warm, analog, and high-contrast, with one neon accent allowed for cyberpunk touches. Define everything as CSS custom properties on `:root` and never hard-code colours elsewhere.

```css
:root {
  --space-black:  #0B0B0D;  /* neutral near-black, NOT blue/purple tinted */
  --soot:         #17171A;
  --cream:        #F1E6CC;  /* aged paper / poster stock */
  --bone:         #E4D8BC;
  --bebop-red:    #E5432B;  /* primary accent */
  --amber:        #F0A81F;  /* secondary accent */
  --teal:         #1E8C87;  /* cool counterweight */
  --neon-cyan:    #3FF2DC;  /* sparing cyberpunk highlight only */
  --rule:         #3A3A3F;
}
```

Rules:
- Pick one dominant colour per page (red, amber, or teal) plus black and cream. Don't use every accent at once.
- Neon cyan is a spice: small labels, a cursor, a status light. Never a wash.
- Backgrounds are solid colours, subtle grain, halftone dots, or star-chart line art. Not gradients.
- If a gradient is ever genuinely needed, use a hard-stop or two-tone warm one (red to amber) as a graphic element, never purple, never a soft glow.
- Body text needs at least WCAG AA contrast (4.5:1) against its background.

---

## 5. Typography

**Always use a retro space / cyberpunk display face for headlines and key UI.** Load from Google Fonts (or self-host) and always set a sensible fallback stack.

Approved display fonts (pick one as the signature, use it consistently):
- **Zen Dots**: rounded retro-futurist
- **Syncopate**: wide, stately, poster-like
- **Michroma**: wide technical
- **Audiowide**: classic retro sci-fi
- **Orbitron**: use sparingly; it is overused, so style it distinctively if chosen
- **Monoton** or **Major Mono Display**: for rare, short decorative moments only
- **Chakra Petch** or **Oxanium**: angular cyberpunk, good for subheads

Approved supporting fonts:
- **Space Mono**, **IBM Plex Mono**, **Share Tech Mono**, **VT323** (terminal / labels / metadata)
- A restrained, readable face for long body text (a mono at comfortable size, or a clean serif like **DM Serif Text**/**Newsreader** for contrast)

Rules:
- Maximum 3 font families on the site: one display, one mono, optionally one body face.
- Never Inter, Roboto, Poppins, Arial, Helvetica, or system-ui as a primary font.
- Headlines: oversized, tight, often uppercase, with deliberate letter-spacing (wide for Syncopate/Michroma, tight for Zen Dots).
- Small labels: uppercase mono, letter-spaced, like instrument-panel or film-slate text.
- Use `font-display: swap`, preload the display font, and verify it actually loads (see section 10).
- Use fluid sizing with `clamp()` so type scales smoothly between mobile and desktop.
- Don't use a gradient text fill, ever.

---

## 6. Layout and composition

- Build on a strict grid, then break it on purpose: offset blocks, oversized numerals, overlapping panels, vertical text, thick rules dividing sections.
- Borders over shadows. Hard edges over soft rounded cards. If corners are rounded, keep them small and consistent, or use cut corners / notched shapes for a hardware feel.
- Use "poster" compositions: big type, flat colour blocks, one strong graphic motif (planet circle, orbit lines, star chart, halftone sun, ship silhouette drawn as simple SVG).
- Use section labelling in the Bebop spirit ("SESSION 01", "MISSION LOG", "BOUNTY BOARD", "SIGNAL"), applied tastefully and not on every element.
- Navigation should feel like part of the design: a slim top bar of mono links, a fixed side index on desktop, a full-screen overlay menu on mobile. Not a generic centred navbar with a white CTA pill.
- Icons: simple custom SVG or typographic glyphs in the site's visual language. No sparkle/wand/rocket stock icons.
- Imagery: grain, halftone, duotone or limited-palette treatments to unify photos. No glossy stock imagery.

---

## 7. Texture and motion

Texture (subtle, never muddy):
- Light film grain overlay (SVG noise or tiny tiled PNG), low opacity
- Optional faint scanlines or CRT vignette on terminal-style components only
- Halftone dot patterns for poster elements

Motion (purposeful, restrained):
- Page-load sequence: staggered text reveals, a typewriter or terminal boot line, a slow orbit or parallax star-chart.
- Hover states: hard colour inversions, underline wipes, tick marks. Not soft glows.
- Respect `prefers-reduced-motion`. Disable or reduce all non-essential animation for those users.
- Animate `transform` and `opacity` only. No layout-thrashing animation. Keep it smooth on mid-range phones.

---

## 8. Responsive: desktop AND mobile, always

Both are first-class. Never ship a layout that only works at one size.

- Design mobile-first, then enhance for tablet and desktop. Desktop should not just be "mobile stretched" and mobile should not be "desktop squished".
- Required test widths: **375px** (small phone), **430px** (large phone), **768px** (tablet), **1024px**, **1440px**, **1920px**.
- No horizontal scroll at any width. Nothing clipped or overlapping unintentionally.
- Use `clamp()`, CSS Grid, Flexbox, `min()`/`max()`, and container-friendly units. Avoid fixed pixel widths for layout.
- Touch targets at least 44×44px. Adequate spacing between tappable elements.
- Body text at least 16px on mobile. Line length roughly 45–75 characters.
- Include `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Use `100svh`/`dvh` rather than `100vh` for full-height sections so mobile browser bars don't break layout.
- Wide display type must be tested on narrow screens: it should shrink or wrap gracefully and never overflow.
- Hover-only interactions must have a tap/focus equivalent.
- Serve responsive images (`srcset`/`sizes`), set width/height to avoid layout shift, and lazy-load below the fold.
- Heavy effects (grain, parallax, large animations) must degrade on mobile for performance.

---

## 9. Following the user's references

When the user provides design examples (screenshots, URLs, Figma frames, mood boards, other sites):

1. **Study them before designing.** Describe back what you observe: palette, type, grid, spacing, shapes, texture, motion, tone.
2. **Extract and reuse their specifics**: colours (sample the actual values), type style and scale, layout structure, spacing rhythm, component shapes, and how sections transition.
3. **Treat references as the authority on style.** Where a reference conflicts with a default in this file, the reference wins. If a reference would trigger the anti-vibe-code rules in section 3 (for example, it uses purple gradients), flag it and ask before copying that part.
4. **Don't clone blindly.** Match the spirit and structure, but build original assets, copy, and details. Do not copy copyrighted artwork, logos, or characters from existing shows or brands. Evoke the era and mood, not the IP.
5. If the user gives new references mid-project, update decisions accordingly and apply them consistently across the whole site.
6. If a reference is unclear or contradictory, ask one focused question rather than guessing.

---

## 10. Verification: always check your work

Never say a task is finished until you have actually run and inspected the result. Do all of the following after every meaningful change:

1. **Run it.** Build and serve the site locally. Confirm it starts with no errors or warnings.
2. **Look at it.** Take screenshots (use a headless browser such as Playwright, or a browser tool if available) at 375, 768, 1440 px at minimum. Actually view them.
3. **Responsive check.** At each width confirm: no horizontal scroll, no overflow or clipping, text is readable, tap targets are usable, nav works, images scale.
4. **Fonts check.** Confirm the retro display font is genuinely loading and rendering (not falling back to a default). Check the computed font-family in the browser.
5. **Colour check.** Confirm there is no purple/violet/indigo anywhere and no purple or soft multi-colour gradients. Confirm text contrast meets AA.
6. **Anti-vibe self-test.** Re-read section 3 against the screenshots. Fix anything that looks like a generic AI landing page.
7. **Reference check.** Compare the result against any user-provided references. Note and fix deviations.
8. **Console and network.** No console errors, no 404s, no failed font/image requests.
9. **Accessibility basics.** Semantic HTML, alt text, visible focus states, keyboard navigation, correct heading order, `prefers-reduced-motion` honoured.
10. **Performance basics.** Optimised images, minimal blocking scripts, fonts preloaded, reasonable Lighthouse scores (aim 90+ for Performance, Accessibility, Best Practices, SEO on mobile).
11. **Fix, then re-check.** If anything fails, fix it and run the checks again. Repeat until it all passes.

When reporting back, state briefly what you checked and anything you couldn't verify. Be honest; never claim a check you did not perform.

---

## 11. Code standards

- Semantic HTML5 (`header`, `nav`, `main`, `section`, `article`, `footer`).
- CSS custom properties for colour, type scale, spacing, and radii. One source of truth.
- Keep the stack simple and fast: plain HTML/CSS/JS or a light framework. No heavy dependencies for decoration.
- Clear file structure, readable class names, comments only where intent isn't obvious.
- No unused code, dead components, or leftover boilerplate.
- Meta tags, Open Graph image, favicon (custom, in the site's style), and a proper `<title>`.

---

## 12. Working agreement

- If the brief is ambiguous (content, sections, personal details, preferred font from the approved list), ask a short question before building large pieces.
- Keep updates concise. Show results, not process.
- Prefer making a few things excellent over many things generic.
- When in doubt, choose the more distinctive, more analog, more human option.

---

## Definition of done

- [ ] Looks like a retro space / Cowboy Bebop-inspired personal site, not an AI SaaS template
- [ ] No purple/violet/indigo, no soft gradient glows, no glassmorphism
- [ ] Retro space/cyberpunk display font is loaded and visibly in use
- [ ] Verified at 375 / 768 / 1440 px with no overflow and good touch targets
- [ ] Matches any provided design references
- [ ] Contrast, accessibility, and performance checks pass
- [ ] All verification steps in section 10 completed and re-run after fixes
