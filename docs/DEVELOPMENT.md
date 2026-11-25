# Development notes

Notes for anyone editing the lab: the visual design tokens and a short usability-test protocol.

## Design tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--navy` (Midnight Navy) | `#102C40` | `#102C40` | masthead, phone nav, big-idea boxes |
| `--cloud` (Cloud White) | `#F7FAFC` | | page ground (light) |
| `--lime` / `--mark` (Electric Lime) | `#CDF23A` | `#CDF23A` | active tab, chosen band, primary action; never text on white |
| `--accent` | `#102C40` | `#CDF23A` | links, focus ring, selection |
| `--good` / `--warn` / `--bad` | green / amber / red | lighter variants | reception status only |
| `--font-display` | Inter Tight | | headings |
| `--font-math` | KaTeX fonts (equations), STIX Two Text (model equations) | | mathematics |
| `--font-body` | IBM Plex Sans | | text |
| `--font-mono` | IBM Plex Mono | | numbers, units |
| Scene: ground wave | `rgb(255,200,61)` | | animation, legend, meter |
| Scene: sky wave | `rgb(255,122,198)` | | animation, legend, meter |
| Scene: D / E / F2 layers | `222,104,66` / `110,190,255` / `150,130,255` | | animation layers and legend |

Spacing: cards use 20–22 px padding and a 20 px gap between cards. Click targets are at least 36 px high.

---

## Usability test (about 30 minutes per person)

Use this to check that students and trainees can use the lab. Test with 5 people; five usually reveal most problems.

**Goal**: can a first-time user find answers about ground-wave coverage without help?

**Participants**: ECE students or broadcast trainees who have not seen the lab.

**Session**
1. Warm-up (3 min): "What do you know about how AM radio reaches listeners?"
2. Tasks (20 min). Ask them to think aloud, and don't help.
   - Lab: "How far does a 1 MHz, 50 kW station reach in the day? And at night?"
   - Lab: "Does a monsoon make coverage better or worse? Why?"
   - Animation: "Find the place where the signal fades. What causes it?"
   - Map: "Add a receiver in Kandy. Will it get good reception? What does the terrain do?"
   - Lab: "Compare FM 100 MHz with MW 1 MHz. Which reaches further and why?"
3. Wrap-up (5 min): "What was confusing? What would you change?"

**Record for each task**: success (yes / with difficulty / no), time taken, where they hesitated, and any wrong conclusion they drew.

**Analysis**: group observations into themes (navigation, terminology, chart reading, map use). Fix the problems that blocked most people first.

---
