# Handoff Spec: Groundwave Propagation Lab v1.4

## Overview
A browser-based radio propagation simulator for students, lecturers and trainee radio engineers. It covers LF to UHF and 2G–5G mobile. Version 1.4 adds two things:

- **Models tab:** shows every equation, its validity range, the ITU reference and its known limitations, plus a live step-by-step calculation, so lecturers can show *why* a prediction looks the way it does and where it breaks down.
- **Phone navigation:** a bottom navigation bar for one-handed use.

It ships as a single self-contained `index.html` (no build step and no framework). CSS custom properties hold the design tokens.

Primary users:
- **Students:** explore and check their own coverage.
- **Lecturers:** project the Models tab and discuss validity and limitations.
- **Radio engineers:** plan cell sites with the Map, Terrain and coverage views.

## Layout
- **Container:** `.wrap`, max-width 1280 px, centred, 16 px side padding (12 px at ≤760 px).
- **App bar:** sticky at the top, holding the brand, tabs (≥761 px), Help and Theme.
- **Tabs (7):** Lab · Animation · Map · Terrain profile · **Models** · Learn · Quiz. Hash routing (`#methods`), with ← and → moving between tabs.
- **Lab:** two columns (settings 340 px | results 1fr), stacking at ≤1020 px.
- **Models tab:**
  1. Intro: h2 and lead paragraph, max 80ch.
  2. **Step-by-step calculation** card. Header row: title plus a "Copy steps" button. Controls row (flex-wrap, gap `space-4`): Model select (min 220 px) and Distance slider (flex 1 1 280 px, log scale). Below the controls: method badge, validity checklist, steps table (# · Quantity · Equation · Value) and footnote.
  3. **Model library** card: 12 collapsible `<details>` cards.

## Design Tokens Used
| Token | Value (light / dark) | Usage |
|---|---|---|
| `--bg` | #eef1f5 / #0d1320 | Page background |
| `--panel` | #fff / #151d2c | Cards, app bar, bottom nav |
| `--ink` | #17202c / #e6ebf3 | Body text |
| `--muted` | #5a6676 / #9aa6ba | Secondary text, equations column |
| `--line` | #d5dbe4 / #28344a | Borders, dividers |
| `--accent` | #1f5fd1 / #6ea8ff | Active tab, links, values, focus ring |
| `--accent-soft` | #e3ecfb / #1a2a47 | Equation block background, active nav pill |
| `--good` / `--warn` / `--bad` | #1d8a5a / #b7791f / #c2413a | Check passed / limitation / failure |
| `--space-1…5` | 4 / 8 / 12 / 16 / 24 px | Gaps and padding |
| `--radius-sm/md/lg` | 6 / 10 / 14 px | Rows / cards / sheets |
| `--shadow-1` | 2-layer, low elevation | All `.panel` |
| `--ease` | cubic-bezier(.2,.7,.2,1) | All transitions |
| `--bnav-h` | 64 px | Bottom nav height (plus safe-area inset) |
| `--font-display` | Archivo 700/800 | Brand, headings |
| `--font-body` | IBM Plex Sans 400–700 | UI text |
| `--font-mono` | IBM Plex Mono 400/500 | Equations, numeric values |

## Components
| Component | Variant | Props / data | Notes |
|---|---|---|---|
| Method badge | Lab, Models | `methodOf(p)` | Lab adds a "Show the calculation →" link button (`data-show-calc`). |
| Validity checklist `.mxchecks` | `li.ok` / `li.no` | `{ok, t}` from `explainCalc` | The icon is ✓ or !, so meaning never relies on colour alone. |
| Steps table `.mxsteps` | — | `{label, eq, val, unit}` | The value cell stays empty for formula-only rows. Numbers use 2 decimals, or exponent form for <0.01 or ≥1000. |
| Model card `.mxcard` | collapsed / open | `MODEL_LIB[]`: name, band, ref, eq[], valid, lim[] | Summary min-height 44 px. Equations sit in `.eqblock` and wrap. |
| Bottom nav `.bnav` | ≤760 px only | Lab · Animate · Map · Models · More | Active item: `aria-current="page"` plus an accent pill behind the icon. |
| More sheet `#moreSheet` | hidden / shown | Terrain profile · Learn · Quiz | Anchored above the nav on the right. Closes on choice or Esc. |

## States and Interactions
| Element | State | Behaviour |
|---|---|---|
| Show the calculation → | Click | Selects the Lab's current model and its receiver distance, then opens the Models tab. |
| Model select | Change | Distance resets to the model's receiver distance (default 2 km for mobile, 100 km otherwise). |
| Distance slider | Input | Log scale: 50 m–100 km for mobile, 1–3000 km otherwise. Re-renders on every input. |
| Copy steps | Click | Copies the steps as TSV. The label changes to "Copied ✓" (or "Copy blocked") for 1.6 s. |
| Checklist row | Fail / limitation | Warn tint background (9% `--warn`) and a "!" icon. |
| Model card | Hover / open | The chevron rotates 90° over 150 ms. |
| Bottom nav item | Active | Accent colour and pill. Inactive items use `--muted`. |
| All interactive elements | Focus | 2 px `--accent` outline, offset 2 px. |

## Responsive Behaviour
| Breakpoint | Changes |
|---|---|
| >1020 px | Full two-column Lab and Map; top tabs. |
| 761–1020 px | Columns stack; top tabs scroll horizontally. |
| ≤760 px | Top tabs hidden and replaced by the bottom nav. Buttons, selects and chips have a 44 px minimum height. Card padding is 14 px. Body padding-bottom = nav height plus safe area. |
| ≤700 px | Live receiver HUD becomes static under the stage. Map is 420 px tall. |
| ≤420 px | Brand title truncates with an ellipsis. |

The bottom nav exists because phone users hold the device one-handed and seven top tabs don't fit without hidden scrolling. The four most-used destinations get thumb-reach slots, and the rest go into More.

## Edge Cases
- **Custom formula:** shows the formula and its result, plus the warning "no validity range".
- **Out-of-range inputs:** every range violation becomes a "!" row with the actual value, so the model is never silently extrapolated. Examples: Hata outside 150–2000 MHz, d outside 1–100 km, hb outside 30–200 m; UMa beyond 5 km; beyond the radio horizon.
- **Skip zone:** for the sky wave, the steps show "no hop returns at this distance".
- **NaN or blank values:** render as "—". Automated test: every preset × 4 distances produces no NaN.
- **Long model names:** the select truncates natively. Equations wrap (`pre-wrap`), and the table scrolls horizontally inside `.tablewrap`.
- **Clipboard blocked** (file://, permissions): the button shows "Copy blocked".

## Animation / Motion
| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Buttons, tabs, chips | Hover / state | Colour and border | 150 ms | `--ease` |
| Model card chevron | Open / close | Rotate 0→90° | 150 ms | `--ease` |
| All | `prefers-reduced-motion` | Transitions removed | 0 | — |

## Accessibility Notes
- **Structure:** Models is a `role="tabpanel"` labelled by `#tab-methods`. The bottom nav is a `<nav aria-label="Main sections">` with real links (`href="#lab"` etc.) and `aria-current="page"`.
- **More sheet:** the "More" button has `aria-expanded` and `aria-controls="moreSheet"`; Esc closes the sheet.
- **Checklist:** `aria-label="Validity checks"`. The icons are `aria-hidden`, and the text carries the meaning.
- **Distance value:** linked to the slider with `aria-describedby`.
- **Focus order on Models:** Copy steps → Model → Distance → library cards (each summary is focusable, and Enter/Space toggles it).
- **Touch targets:** at least 44 × 44 px on phones.
- **Contrast:** body text and `--muted` meet 4.5:1 on `--panel` in both themes.

---

## v3.0 additions

### Information architecture
| Tab | Purpose |
|---|---|
| Lab · Animation · Map · Terrain | Ground wave, sky wave and VHF/UHF **broadcasting** (no mobile models here) |
| **Mobile** (new) | 2G–5G planning: towers, test points, link budget, coverage heat map, My coverage, OpenCelliD |
| Models | Equations, step-by-step calculation (incl. "Mobile planner"), verification tests, measured-data comparison with **Calibrate**, **Print / PDF report** |

The Map and Mobile tabs share one map component (`#mapCore`), moved into `#mapSlot` or `#mobMapSlot`. Each layer keeps its own state (`MP.S.bcast`, `MP.S.mobile`). Elements marked `.bcast-only` or `.mob-only` show only in their layer (`body[data-layer]`).

### New components
| Component | Behaviour | Notes |
|---|---|---|
| Place search (`#mapSearch`) | Nominatim forward search (6 results, biased to the current view), list of places → action bar | Actions: + Transmitter / + Relay / + Receiver here (broadcast), + Tower / + Test point / This is me (mobile). Esc closes the list |
| Map toolbar (`.toolrow`) | Segmented actions with icons and a live hint line (`#modeHint`) | 40–44 px targets; the cursor is a crosshair while placing |
| Relay table (`#relayTable`) | Name, source TX, feed distance, input field and needed level, status pill (Fed / Weak input / Not fed), mast, ERP, output frequency, delete | A dashed feed line on the map: green = fed, amber = weak, red = not fed |
| Best-server table (`.srvtab`) | Every transmitter, relay or tower with its level and result; ★ marks the serving one | Ranking by margin (field − minimum, or the mobile link margin) |
| Planner (`.planner`) | Tower height, EIRP, cell edge, uplink MAPL, total→reference offset, % locations; tiles and a reference-level chart | "Reset to typical values" removes the overrides |
| Share link (`#shareBtn`) | Copies `?s=<base64url state>`; autosave to `localStorage` key `gwlab-state-v2` | — |
| Live NOAA (`#liveFlare`) | GOES 0.1–0.8 nm flux → class and R-level, applied to the selected model | Fails gracefully offline |

### Standards used
- **Propagation:** ITU-R P.368, P.1147, P.1812, P.526, P.2108, P.2109, P.838, P.529, M.2412; reception levels from BS.703, BS.412 and BT.417.
- **Relay feed:** input ≥ minimum usable field + 10 dB (planning practice for off-air pick-up).
- **UI:** WCAG 2.1 AA (focus rings, 44 px targets on phones, labelled controls, `aria-live` hints, reduced motion).

---

## v4.0 — professional UI pass + antenna-pattern coverage

### Design system (replaces the v3.2 `!important` patch layer)
Tokens live in one block at the head of the v4 layer in `src/style.css`:

| Group | Tokens |
|---|---|
| Spacing (4pt) | `--sp-1`…`--sp-6` = 4/8/12/16/24/32 px |
| Type | `--fs-meta` 12, `--fs-dense` 14, `--fs-ui` 15, `--fs-body` 16, `--fs-h3` 17, `--fs-h2` 20, `--fs-h1` 24 |
| Weights | 400 / 500 / 600 only — no 700+ anywhere |
| Radius | `--r-sm` 6, `--r-md` 10, `--r-lg` 14, `--r-pill` 999 |
| Elevation | border first, then `--shadow-1` / `--shadow-2` |
| Motion | `--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-in-out: cubic-bezier(.77,0,.175,1)`, `--dur-1/2/3` = 120/160/200 ms |
| Layout | `--rail: 380px`, `--field: #eef1f5` |

Only `transform` and `opacity` animate. `prefers-reduced-motion: reduce` drops
transform-based motion and keeps opacity.

### Map workspace (≥1280px)
`#mapCore` is a grid: `"tools tools" / "map rail" / "legend rail" / "hint rail" / "sites sites"`.
The result rail is `position: sticky; top: 76px`. Below 1280 it stacks; on phones
the order is map → tools → result.

- `#setupBox` (`details.setup`) is **closed by default** at every width; `#setupSum`
  carries the one-line summary (TX → RX · f · power · heights · time).
- `#legendBox` (`details.legend-d`) opens at ≥1024, closed below.
- `.scrollrow` gets `.ovf` from `markOverflow()` (`src/lab.js`), which applies a
  right-edge mask so a clipped chip reads as scrollable.

### Antenna-pattern coverage (`src/aui.js`)
`#covMode` replaces the old two checkboxes: `contour` (default) / `heat` / `off`.

- `contourFromTable(T)` — solves, per 4° azimuth, the distance at which the field
  falls to the minimum usable level. Interpolates the omni ds/vs table and refines
  with `depressionDeg` for f ≥ 30 MHz. The result **is** the antenna pattern at
  true map scale.
- `bcContours()` caches on `BCH.key`; `cellContours()` uses
  `d = 10^((EIRP + G(az) − threshold)/b)` clamped to `F.rmax`.
- `drawContours()` — skips below 6 px span, draws a normalised `drawRosette()`
  between 6 and 34 px, otherwise a filled polygon with a white halo and a coloured stroke.
- The old fixed-radius service circle is suppressed whenever contours are on.

### Accessibility (WCAG 2.1 AA, verified by `a11y.js` / `a11y2.js`)
0 contrast failures · 0 unlabelled controls · 1 `h1` · no heading skips ·
no duplicate ids · no positive `tabindex` · every `role="tab"` has `aria-controls` ·
every canvas has an accessible name · skip link present · `lang="en"`.
Checkbox/radio hit areas are ≥24 px via their wrapping or `for=` label
(`.seg` inputs stay visually hidden — the segment label is the target).

### LMS embedding
Inside an iframe (`window.top !== window.self`) downloads are blocked, so:
`#dlCsv` and the GPS button stay hidden, and `#qExport` relabels to
**Copy results (CSV)** and writes to the clipboard instead.
Map tiles are also blocked by the host CSP; the app falls back to the vector
outline and says so. The standalone file and the hosted site are unaffected.

### Regression suite
`audit.js` (375 + 1280: overflow / <12px text / weights) · `shot19` (console errors)
· `shot24` (share link, flare, mobile steps) · `shot26` (obstacle naming, full screen)
· `shot27` (**24/24 verification tests**, antenna panel, heat map) · `shot30` (sectors,
downtilt) · `shot31` (beam drag) · `shot32` (contour extents) · `shot33` (phone
defaults) · `a11y.js`, `a11y2.js`.
