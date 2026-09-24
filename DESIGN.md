# Design

Visual system for Lighthouse (Expo / React Native, NativeWind + `@lighthouse/tokens`). Light mode only. Source of truth is `packages/tokens`.

## House style: Arc Glass (project rule)

Lighthouse uses the **Arc Glass** family (white base, one soft dull radial pastel wash, translucent layered surfaces, big confident type, generous space). Apply the `pleasant` skill, which builds on `impeccable`. The wash primitive is `ArcWash` in `@lighthouse/ui`.

Hard rules (non negotiable, enforced in every screen):

1. No linear gradients. The only gradient allowed is one dull `ArcWash` radial per screen. The old cyan linear hero/device gradients stay removed (onboarding Slide 1 uses the soft wash like every other screen, no flash, no color animation).
2. Never the color purple, anywhere.
3. No status dots (Active / Paused / Live). Use quiet text.
4. No uppercasing via `textTransform`; labels are sentence case (the `section-label` token no longer forces caps).
5. No visible scroll bars (`showsVerticalScrollIndicator={false}`).
6. No dashes or hyphens in UI copy; reword with commas, periods, parentheses.
7. Minimal by default, with exactly one restrained wow moment per screen.

## Theme

Light, calm, trustworthy. Scene: a parent glancing at their phone in daylight wanting reassurance; a teen checking what's seen on their own phone. Warm-white surfaces, soft shadows, breathing room. Not a dark "surveillance" tool, not a dense dashboard.

## Color

Strategy: **Restrained.** Tinted-neutral canvas, cyan as a scarce accent (live/actionable only).

- Brand cyan `#1CABE2` (primary). Scale `primary.50 #E8F7FC` → `primary.900 #0A4A6A`. Hero gradient `#0E7FA8 → #1CABE2`.
- Neutrals are blue-tinted (not pure gray): `white #FFFFFF`, `50 #F5F7FB` (canvas/surface), `100 #E8ECF0` (hairline), `400 #8E8E93` (muted text), `900 #1A1A1A` (text). Never `#000`/`#fff` for text.
- Semantic: success reuses cyan (no green in system); warning `#F59E0B` on `#FFF3CD`; alert `#FF6B6B` on `#FFE8E8`; severe/error `#FF3B30`. Always pair color state with icon + label.
- Category chips: soft tinted bg + readable fg (see `colors.category`).

## Elevation (premium direction)

Current screens lean on 1px hairline borders and feel flat. Move to **soft, layered shadows** for the Apple-calm feel. Standard tokens (iOS-style, low-contrast):

- `e1` (resting card): shadowColor `#0E2A3A`, opacity 0.05, radius 12, offset y 4. Hairline optional, drop where shadow carries it.
- `e2` (raised / interactive): opacity 0.08, radius 20, offset y 8.
- `e3` (sheets/modals/hero): opacity 0.12, radius 28, offset y 12.

Shadows tint toward deep brand blue, never neutral black. Android: pair with matching `elevation`.

## Typography

DM Sans (400/500/600/700) + IBM Plex Mono (numerals, codes, counts). Roles in `tokens/typography`:

- `display` 26/32/700, `heading-lg` 22/30/700, `heading-md` 18/24/700, `body` 15/22/400, `body-sm` 13/18/400, `button` 16/20/600, `section-label` 12/16/600 caps +0.6, `metric` 30/34/700.
- Hierarchy via scale + weight (≥1.25 steps). Headings get slightly negative tracking (-0.3 to -0.5). Numerals (counts, %, codes, times) use the mono font. Body line length capped ~70ch.

## Spacing & Layout

4px base: `xs 4, sm 8, md 12, lg 16, xl 20, 2xl 24, 3xl 32, 4xl 40`. Screen gutters 20. **Vary rhythm**: larger gaps between sections (24–32) than within (8–12). Avoid uniform padding everywhere. Cards only when they're the right affordance; never nest cards; replace dashed-border "add" tiles and binary dashed grids with quiet solid/tinted treatments.

## Radii

`sm 8, md 12, lg 14 (buttons), xl 16, 2xl 20 (sheets/hero), pill 9999`. Keep a consistent family per surface; large soft radii for hero/sheets read as premium.

## Motion

Ease-out-quint/expo only, ~200–320ms. Subtle entrance (fade + 8–12px rise, staggered), press (scale 0.97 / opacity). No bounce/elastic. Honor reduced-motion → opacity-only.

## Components

- **Card**: warm-white, radius `xl`, elevation `e1`, padding `lg`. The default container.
- **Hero / status**: cyan gradient `#0E7FA8→#1CABE2`, radius `2xl`, elevation `e2`, white text; used once per screen for the primary status.
- **Section label**: caps `section-label`, muted, with generous top margin.
- **Buttons**: primary = cyan fill, white label, radius `lg`; secondary = hairline/quiet. Pill chips for filters/toggles.
- **Tab bar**: cyan active, muted inactive, hairline top.
