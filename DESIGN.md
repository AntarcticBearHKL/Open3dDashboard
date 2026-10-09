# 3D Asset Browser (asset-browser) Design System

> This file is the implementation contract. Every color, size, spacing value, radius, shadow, and motion rule used in `src/` must trace back to a token declared here. Raw hex outside this file is a defect.

## 0. Research Log

- **Reference (user-supplied extraction of the live site):** **studionamma.com** — a Swiss/editorial monochrome system: light grey canvas `#e4e4e4`, ink `#111111`, secondary text ≈55% ink, tertiary ≈33% ink, hairlines ≈15% ink, muted surface tints ≈5–8% ink, emphasis as **solid black blocks** (the black cookie bar / "ACCEPT COOKIES →" CTA), condensed extra-bold uppercase display type at ~0.82 leading / −0.03em tracking, grotesque body, uppercase mono eyebrows (~+0.09em tracking), ~5px controls, and a trailing `→` on CTAs. The extraction was performed by the requester; the values above are treated as the visual contract.
- **Layer A (taste):** `minimalist-skill.md` — flat editorial monochrome, hairline-only structure, no gradients/heavy shadows, ink-block primary buttons. One deviation is documented under Accepted Debt: the skill bans Inter, but the brief mandates `"Inter", "Helvetica Neue", Arial, system-ui` as the grotesque body stack and there are no webfont downloads.
- **Layer B (brand):** none of the 70 curated systems matches Studio Namma; the live-site extraction above is the token source instead.
- **Redesign lane:** `redesign-skill.md` — audit-first, work within the existing vanilla-CSS stack, do not restructure the JS contract. Applied as: full token-block + component re-skin, zero behaviour change.
- **Licensed-font substitution:** "Mixtape Extra Condensed" (display) and "GT Pressura Mono" (mono) are licensed and cannot ship offline. Offline equivalents are declared in §3 and named in Accepted Debt.
- **Lanes not run (named skips):** Lazyweb / Imagen / StyleGallery / ui-ux-db — the reference is explicitly supplied with exact tokens, this is a re-skin of an existing layout (not a new spatial design), and the app must stay dependency-free and offline. Layout mechanics are frozen by the brief (§4).
- **Verification:** `/visual-qa`-style manual pass in the real browser at `http://127.0.0.1:8099/?base=/lib/` after `npm run build` — light canvas, ink type, condensed display headings, mono eyebrows, black primary buttons; filters, card actions, cart drawer, detail dialog, Blender/Unity dialogs exercised.

## 1. Atmosphere & Identity

**A printer's proof for a physical archive.** The surface is a flat light-grey sheet (`#e4e4e4`) with ink (`#111`) and hairlines as the only structure — no boxes-with-shadows, no gradients, no colour. The signature is the **black code plate**: every asset code (`AR-0001`) is a small solid-ink pill with light mono text, the darkest object on the wall, exactly like a stamped tag on a specimen sheet. The one moment with maximum contrast is the **detail dialog**: a muted-grey preview well holding the render, beside a spec sheet of uppercase mono eyebrows and mono data rows, with a full-width solid-black "Open in Blender →" block as the single loud element.

Restraint is the ambition: black is the accent. Nothing else is chromatic except two semantic status dots (green = connected, red = destructive).

**Dials:** `DESIGN_VARIANCE: 3` (repeating catalog grid; predictability is the feature) · `MOTION_INTENSITY: 3` (feedback-only motion) · `VISUAL_DENSITY: 7` (many items per screen, mono numbers, tight metadata rows).

## 2. Color

### Palette

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Canvas | `--c-bg` | `#e4e4e4` | Page background — the single flat surface |
| Ink | `--c-ink` | `#111111` | Solid emphasis blocks: primary buttons, plates, active chips, toasts |
| Ink/inverse text | `--c-ink-inverse` | `#e4e4e4` | Text and glyphs on any ink fill (≈15:1) |
| Text/primary | `--c-text` | `#111111` | Headings, values, card codes, body (≈15:1 on canvas) |
| Text/secondary | `--c-text-2` | `rgba(17,17,17,.75)` | Body, slugs, values (7.5:1) |
| Text/tertiary | `--c-text-3` | `rgba(17,17,17,.62)` | Metadata, eyebrows, captions (4.9:1) |
| Text/disabled | `--c-text-4` | `rgba(17,17,17,.4)` | Placeholders, disabled, decorative glyphs (WCAG-exempt; never essential copy) |
| Border/hairline | `--c-line` | `rgba(17,17,17,.15)` | Default hairlines, card borders, dividers |
| Border/strong | `--c-line-2` | `rgba(17,17,17,.28)` | Hover borders, input borders, dialog edge |
| Surface/tint | `--c-tint` | `rgba(17,17,17,.05)` | Inputs, thumb wells, hover washes, preview well |
| Surface/tint-2 | `--c-tint-2` | `rgba(17,17,17,.08)` | Pressed/deeper washes (card action hover) |
| Status/success | `--c-ok` | `#2f8f5b` | Connected status dots, texture-ok dot **only** |
| Status/error | `--c-err` | `#b42318` | Destructive text, remove hovers, error copy (5.2:1) |
| Overlay | `--c-scrim` | `rgba(17,17,17,.55)` | Dialog/drawer backdrop |

### Rules
- **Monochrome. Black is the accent.** No chromatic accent, ever; the two status colours are semantic and never decorative.
- The only allowed gradient is none: fills are flat. Emphasis is achieved by full ink blocks (`--c-ink` + `--c-ink-inverse`), state by ink washes (`--c-tint`, `--c-tint-2`) or a glyph.
- Elevation is hairline + wash, not shadow. `--shadow-overlay: 0 24px 64px rgba(17,17,17,.18)` is reserved for true overlays (dialogs, drawer, toasts).
- Never introduce a colour not in this table. Extend the table first.
- **Ramp deviation (documented):** the reference renders secondary body at ≈55% ink and tertiary at ≈33%. At this tool's 11–15px sizes those ratios compute to ≈3.9:1 / ≈2.1:1 on `#e4e4e4` and miss WCAG AA, so the shipped ramp tightens them to `.75` / `.62` (7.5:1 / 4.9:1) while keeping the same visual hierarchy; `≈33%` survives as `--c-text-4` for WCAG-exempt use only.

## 3. Typography

### Scale

| Level | Size / Line | Weight | Tracking | Usage |
|-------|-------------|--------|----------|-------|
| Display/hero | `clamp(44px, 7vw, 76px)` / 0.82 | 800 condensed | −0.03em | Welcome title |
| Display/lg | 26px / 0.9 | 800 condensed | −0.02em | Dialog titles (Blender, Unity) |
| Display/md | 24px / 0.9 | 800 condensed | −0.02em | Cart drawer title |
| Display/sm | 20px / 0.9 | 800 condensed | −0.02em | Brand name |
| Display/empty | 30px / 0.9 | 800 condensed | −0.03em | Empty-state title |
| Body | 14px / 1.5 | 400 | 0 | Default UI text |
| Body/sm | 13px / 1.5 | 400 | 0 | Secondary rows, metadata, notes |
| Caption | 12px / 1.4 | 400 | 0.02em | Chips, small rows |
| Eyebrow | 11px / 1.3 | 400 mono | +0.09em | Section labels, counts, status captions (uppercase) |
| Mono/data | 12px / 1.4 | 400 mono | 0 | tri counts, dimensions, paths, spec values |
| Mono/plate | 11.5px / 1.1 | 500 mono | +0.04em | Asset codes on ink plates |

All display levels are uppercase with `font-synthesis-weight: none` so single-weight faces (Haettenschweiler/Impact) render their native extra-bold instead of a synthesized smear.

### Font Stack
- **Display** (hero/brand/dialog/empty titles only): `"Haettenschweiler", "Arial Narrow", "Impact", "Oswald", system-ui, sans-serif` — offline equivalents for Mixtape Extra Condensed. Haettenschweiler ships on Windows; Arial Narrow / Impact are the fallbacks; `font-weight: 800` lets Oswald's real heavy face win when a user has it installed.
- **UI/body**: `"Inter", "Helvetica Neue", Arial, system-ui, sans-serif` — grotesque character per the reference, 13–15px for density (not the reference's 19px).
- **Mono**: `"Cascadia Mono", "Consolas", ui-monospace, monospace` — labels, eyebrows, codes, counts, paths, table data, bridge config.
- **No webfont downloads.** Only locally-installed/system faces; the app must work offline.

### Rules
- Eyebrows/overlines are always uppercase mono at `+0.09em`; never sentence-case.
- Numeric or identifier data (codes, tri counts, dimensions, paths, URLs) is always mono with `tabular-nums`.
- Display faces are never used below 20px, never for body or metadata.
- Body never below 12px; 11px only for eyebrows/chips (non-essential).
- Headings never wrap past 2 lines in fixed chrome; truncate with ellipsis where the container is fixed.

## 4. Spacing & Layout

### Base Unit
4px. Tokens: `--sp-1:4 --sp-2:8 --sp-3:12 --sp-4:16 --sp-5:20 --sp-6:24 --sp-8:32 --sp-10:40 --sp-12:48 --sp-16:64`.

### Grid variables
- Content max width: 1760px (dense catalogs want the extra columns), page gutter `clamp(16px, 2.4vw, 32px)` (mechanics, raw).
- Card track: `minmax(min(212px, 100%), 1fr)`; gap `--sp-3` (12px) desktop / `--sp-2` mobile.
- Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280`. Full-height shells use `100dvb`, never `100vh`.
- App column: `.app` declares `grid-template-columns: minmax(0, 1fr)` and `.topbar`/`.toolbar` carry `min-width: 0` — chrome min-content must never widen the shell (verified fix for 390px horizontal overflow).

### Scroll ownership (unchanged, frozen by the brief)
| Region | Owner | Mechanics |
|--------|-------|-----------|
| App shell | none (fixed rows) | `grid-template-rows: auto auto minmax(0,1fr)`; shell bounded by `100dvb` |
| Asset wall | **the grid body** (`#grid-scroll`) | `overflow:auto; min-block-size:0` — the only page-level scroller |
| Cart drawer | the drawer's item list | `grid-template-rows:auto minmax(0,1fr) auto`, list `overflow:auto` |
| Detail dialog | the spec pane (right column) | dialog body `overflow:hidden`; spec pane `overflow:auto; min-block-size:0` |

### Layout primitives in use
`scroll-body-shell` (page), `ram-grid` (cards), `cluster` (tag rows, toolbar actions), `stack` (card content, spec rows), `sidebar` (spec pane beside preview, wraps under 900px), `frame` (16:10 preview with `aspect-ratio`), `overlay-stack` (dialog + scrim), `content-limiter` (export textarea measure).

### Content stress rules
- Card slug: single-line ellipsis. Card tag cluster: wraps and shows every tag (no slice, no row cap).
- Long unbroken strings (paths, codes): `overflow-wrap:anywhere` + `min-inline-size:0` on their containers.
- Empty states designed for: no library loaded, no filter matches, empty cart, asset without preview, asset without textures.

## 5. Components

All components are built from the tokens above. Every interactive element has default / hover / active / focus-visible / disabled states. **Selected/active state is a solid ink block or an ink wash + glyph — never a coloured border** (`focus-visible` rings are the only edged state).

### Buttons
- `.btn` base: radius `--r-5` (5px), `min-block-size:32px`, padding `0 12px`, 1px `--c-line-2` border, transparent fill, `--c-text` text, `transition: background/border/color/transform 110ms`.
- Variants:
  - `.btn--primary` — **solid ink block**: `--c-ink` fill, `--c-ink-inverse` text, ink border; hover `#000`; carries a trailing `→` (`.btn__arrow`) where it reads as a CTA.
  - `.btn--ok` — markup hook retained for the cart Export; renders identically to `.btn--primary` (green is reserved for status dots, §2).
  - `.btn--ghost` — transparent fill, `--c-line-2` border; hover ink wash `--c-tint`.
  - `.btn--danger` — `--c-err` text on transparent; hover `rgba(180,35,24,.08)` wash.
  - `.btn--icon` — 32×32 (26×26 as `.btn--sm`).
  - `.btn--xl` — full-width 13px-padded primary (detail "Open in Blender").
- `.btn__arrow`: trailing `→` glyph in mono; `aria-hidden="true"` (the label carries meaning). Used on: welcome "Choose library folder", drawer "Export codes", detail "Open in Blender", Blender "Import cart to Blender", Unity "Place cart assets".
- Disabled: `opacity:.4; pointer-events:none`.
- Focus-visible: `outline: 2px solid var(--c-text); outline-offset: 2px` — the single allowed focus ring, highly visible on the light canvas.

### Topbar actions
- Three controls, in this order: Blender trigger, Unity trigger, cart trigger. Shared rule `.btn.topbar__blender, .btn.topbar__unity, .btn.topbar__cart` (**doubled specificity because `.btn` is defined later in the sheet — keep this pattern**): borderless, transparent, `--c-text-2`; hover `--c-tint` wash and `--c-text`.
- Blender / Unity triggers carry a 9px status dot: `#8f8f8f` for every non-connected state (`checking`/`warn`/`down`), `--c-ok` green only when connected. Static — never animated.
- Cart trigger: borderless like the others; while the drawer is open (`aria-expanded="true"`) it becomes a **solid ink block** (ink fill, inverse text). Semantics: `aria-label="Cart"`, `aria-haspopup="dialog"`, `aria-controls="cart"`, `aria-expanded` toggled by the drawer. The cart count plate appears only in the drawer header.
- Under 640px the three labels collapse (`.topbar .btn__label` hidden, 9px padding) so the chrome stays icon-sized; each trigger keeps its accessible name.

### Fields (search / select)
- `.field--search input` and `.pick select`: `--c-tint` fill, `--c-line` border, radius 5, height 32 (34 on mobile), 13px text; placeholder `--c-text-3`.
- Search has a leading icon and a clear (X) affordance when non-empty.
- Selects are native with `color-scheme: light`; the chevron is an inline SVG at 111111. Real `<label>`s above (visually hidden via `sr-only` where needed).
- Toolbar filters: search, top-level category, subcategory, sort, and **Style** — the library's five tier tags (`lowpoly` / `stylized` / `semi-realistic` / `realistic` / `photoreal`); picking one keeps assets whose `tags` include it. Every active filter renders as a chip (§ Chips) with a Clear-filters action.
- Focus-visible: ink outline at 1px offset + ink border.

### Eyebrow labels
- `.eyebrow` — 11px uppercase mono `+0.09em`, `--c-text-3`. Placed on: the welcome card ("LOCAL-FIRST · OFFLINE"), the toolbar ("LIBRARY"), the cart drawer ("SELECTION"), the detail spec pane ("ASSET DETAILS"), and both bridge dialogs ("LOCAL BRIDGE"). The spec-pane section labels (Identity / Tags / Specs / LOD files / Textures / Paths) and the bridge field captions are styled as eyebrows directly.

### Chips
- `.chip`: 11px mono, 22px height, radius 4, `--c-line` hairline, transparent fill, `--c-text-3`; hover ink wash + `--c-text`.
- `.chip--tag` (tags on cards and in the detail sheet): uppercase, 10–10.5px, `+0.06em`.
- `.chip--active` (active filter): **solid ink block** (inverse text) + trailing ✕ glyph; clicking clears.
- `.chip--warn`: dashed hairline, tertiary text (No-textures marker).

### Asset card (`.card`)
- Structure: `article.card` → `.card__thumb` (frame 16:10, `--c-tint` well, skeleton pulse, `<img>` fade-in) → `.card__body` (row 1: ink code plate + four 28px actions; row 2: mono slug, single-line ellipsis) → `.card__tags` (hairline `border-top`, then every tag as a wrapping uppercase chip; omitted when no tags).
- Card surface: transparent fill + `--c-line` hairline, radius 5; hover `--c-tint` wash + `--c-line-2`.
- Actions (left → right): add/remove cart (`.btn--cart-toggle`, plus ↔ check, `aria-pressed`), copy item info (`[data-copy-item]`), import to Blender (`[data-blender-item]`), place into Unity (`[data-unity-item]`). Transparent at rest; hover `--c-tint-2` + `--c-line-2` + ink glyph; **in-cart = solid ink block**.
- Full-card open affordance: absolutely-positioned `button.card__open` with `aria-label="View {code} {slug}"`; actions and tags sit above it (z-index). No nested interactive elements.
- Focus-visible: inset ink ring on `.card__open`; outline ring on every action/chip.
- Deliberately not on the card: per-asset refresh, category line, tri/texture footer, LOD badge.

### Code plate (`.plate`)
- **Solid ink pill**: `--c-ink` fill, `--c-ink-inverse` mono 11.5px/500 `+0.04em`, radius `--r-full`, padding `3px 8px`. This is the signature component. Never used for anything but asset codes, the cart count, and the preview texture badge.
- `.plate--count.is-empty`: transparent + hairline + tertiary text.
- `.plate--sm`: 10.5px (drawer header, cart rows, preview badge).

### Cart drawer (`.drawer`)
- Right-side panel, width `min(400px, 100vw)`, `--c-bg` surface, left `--c-line-2` hairline, overlay shadow; `translateX(102%)` → `0` over 240ms.
- Header: eyebrow "SELECTION" + display title "CART" + ink count plate + close icon.
- Rows: 46px tinted thumb (hairline frame), code plate + mono slug + category, remove icon-button (red hover).
- Footer: Export codes (ink primary + `→`) and Clear (danger text), stacked full-width. Export copies the cart JSON and clears; count lives in the header.
- Empty cart: body intentionally blank — no empty-state copy.
- `role="dialog" aria-modal="true"`, ESC closes, focus moves to close on open and returns to the trigger on close.

### Detail dialog (`.detail`)
- `<dialog>` `showModal()`; width `min(1180px, calc(100vw - 32px))`, height `min(780px, 88dvb)`. Body is a sidebar: preview pane (fluid, min 380px) + spec pane (340px, own scroll). Under 900px it stacks, preview capped at 42dvb.
- Preview pane: flat `--c-tint` well (no gradient), render with `--r-4` corners + soft shadow, a **black plate badge** for the texture count, placeholder fallback when missing. No in-browser 3D.
- Spec pane sections (uppercase mono eyebrow labels): Asset details → Identity (code plate, slug, name_original, description), Tags (chippable), Specs (mono table: Triangles / Size / Textures / LODs), LOD files, Textures (dot + name), Paths (asset + fbx).
- Footer: "Open in Blender →" (`.btn--xl` ink block, full width) then a 2-up ghost row: Place in Unity + Add/Remove from cart.
- No footer Close — the header ✕ closes.

### Token plates in the data model
Asset codes are shown as ink plates everywhere: card row, drawer row, detail header, preview badge. The count badge reuses `.plate--count`.

### Toast
- Single stack, bottom center, **solid ink** background with inverse text, radius 5, 13px, `role="status" aria-live="polite"`, 2.4s, transform/opacity only. Error toasts print their text in `#ffb4ab`.

### Empty / loading
- Empty state: centered block with a hairline glyph square, display title (30px condensed uppercase), one-line hint (13px `--c-text-3`), the action button where one exists.
- Skeleton: preview placeholder pulses opacity 0.5→0.8 (compositor-only); replaced by the image on load.
- Chunk sentinel: 24px strip driving the next page of 160 cards via IntersectionObserver.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 110ms | `cubic-bezier(.2,.8,.3,1)` | Button press, chip toggle, card hover, input border |
| Standard | 240ms | `cubic-bezier(.16,1,.3,1)` | Drawer slide, dialog enter, toast, image fade |
| Emphasis | 320ms | `cubic-bezier(.16,1,.3,1)` | First shell paint after data load (fade+8px rise, once) |

### Rules
- Only `transform`, `opacity`, `filter` animate. Never layout properties.
- **Motion must be motivated.** Allowed: hover/press feedback, drawer/modal enter-exit, toast, image fade-in, the first-load shell reveal. Decorative loops are forbidden; the only continuous animation is the skeleton pulse on unloaded previews.
- `prefers-reduced-motion: reduce`: durations collapse to 1ms; hover scale is dropped; skeletons stop pulsing.
- No `window.addEventListener('scroll')`. `IntersectionObserver` drives lazy images and pagination.
- Feedback thresholds: press shows state on the same frame; async work disables the control immediately; failures print next to the object that failed.

## 7. Depth & Surface

### Strategy
**Flat monochrome: hairlines at two strengths + ink washes. No elevation gradient.** Shadows only for true overlays.

| Level | Treatment | Usage |
|-------|-----------|-------|
| 0 Canvas | `--c-bg` | Page, topbar, toolbar, drawer, dialogs — one flat sheet |
| 1 Hairline | `1px --c-line` border | Cards, dividers, section rules, thumbs |
| 2 Strong hairline | `1px --c-line-2` | Input borders, dialog edge, drawer edge, hover borders |
| 3 Wash | `--c-tint` / `--c-tint-2` fill | Inputs, wells, hovers, pressed |
| Ink block | `--c-ink` fill | Primary buttons, plates, active chips, toasts, cart-open state |
| Overlay | `--c-bg` + `--c-line-2` + `--shadow-overlay` + scrim | Dialogs, drawer |

Radius scale: `--r-4:4px` (chips, thumbs, code notes) · `--r-5:5px` (buttons, inputs, cards, toasts) · `--r-8:8px` (dialogs, welcome card) · `--r-full:999px` (plates only). Nested corners stay concentric (inner = outer − padding).

Gradients: **none in chrome.** The only surface treatment is the flat tint wash. The brand mark and favicon are flat ink cubes.

## 8. Accessibility Constraints & Accepted Debt

### Constraints
- WCAG 2.2 AA. Contrast measured against `--c-bg` `#e4e4e4`: `--c-text` ≈15:1, `--c-text-2` ≈7.5:1, `--c-text-3` ≈4.9:1, `--c-err` ≈5.2:1; `--c-ink-inverse` on `--c-ink` ≈15:1. `--c-text-4` (≈2.6:1) is used only for placeholders, disabled controls and decorative glyphs — never essential copy.
- Focus-visible ring on every interactive element: `2px solid #111` at 2px offset (1px on inputs) — visible on all surfaces including ink blocks via the offset gap.
- Keyboard: Tab order follows DOM; dialog ESC closes; drawer returns focus to its trigger; `/` focuses search.
- Landmarks: `header`, `main` (the grid), `aside` (drawer), `dialog`; `<label>` for every field; `aria-live` for counts and toasts; images carry `alt="{code} {slug} preview"`.
- `prefers-reduced-motion` respected globally (§6).
- Hit targets ≥ 28px, primary controls ≥ 32px.
- Colour is never the sole carrier of meaning: connected dots keep their shape/size, selection carries a glyph (✕, check).

### Accepted Debt
| Item | Location | Why accepted | Owner / Exit |
|------|----------|--------------|--------------|
| Licensed faces (Mixtape Extra Condensed, GT Pressura Mono) replaced by offline system equivalents | `--font-display`, `--font-mono` in `src/styles.css` | No webfont downloads — the app must stay fully offline; system faces are the contract | Revisit only if local font files are ever added to the repo |
| Text ramp tightened from the reference (55/33% ink → 75/62%) | §2 Palette | The reference's alphas miss WCAG AA at 11–15px; hierarchy is preserved | Revisit if body type ever grows to ≥24px |
| FSA directory permission is re-requested per session (browser model); HTTP mode exists as the no-permission path | `src/lib/library.js` | File System Access API security model; cannot be persisted | Documented in README |
| Preview PNGs are 512×512 with no downscaled variants | grid thumbnails | Library is read-only by contract; browser decodes at paint size | `img decoding="async"` + lazy load mitigates |
| No in-browser 3D viewer; model inspection requires Blender + the local bridge | detail panel | three.js was removed to keep the app dependency-free; the bridge covers real inspection | Documented in README |
| No dark/light switch: the app is light-native | global | Single-user local tool; the brief specifies this monochrome light system | n/a |
