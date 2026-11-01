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
