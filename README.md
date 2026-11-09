# Groundwave Propagation Lab: public website

This folder is a complete static website. Upload it to any free static host to get a public link that anyone can open.

- `index.html`: the whole app (Lab, Animation, Map & location, Cellular, Models, Learn, Quiz).
- `assets/`: the mast photograph used on the home screen and the KaTeX stylesheet and fonts that typeset the equations. **Upload this folder together with `index.html`**, or the hero photo and the equations will not display correctly.
- `_headers`: security and caching headers for Cloudflare Pages.

When the page is served from a real website (https), these all work:

- OpenStreetMap and OpenTopoMap map tiles
- worldwide terrain heights (Copernicus DEM via Open-Meteo)
- the "Use my location" GPS button
- CSV download

---

## Option A: Cloudflare Pages (free, recommended)

1. Create a free account at https://dash.cloudflare.com/sign-up (an email address is enough).
2. In the dashboard open **Workers & Pages → Create → Pages → Upload assets**.
3. Name the project, for example `groundwave-lab`. The name becomes the address `https://groundwave-lab.pages.dev`.
4. Drag this whole folder (or the zip) into the upload box and press **Deploy site**.
5. Open the `*.pages.dev` link. It is public: share it with anyone.

To update later: in the project, choose **Create deployment** and upload the new folder.
Optional: **Custom domains** lets you attach your own domain for free (you pay only for the domain itself).

## Option B: GitHub Pages (free)

1. Create a public repository, for example `groundwave-lab`.
2. Upload `index.html` (and `_headers`, which GitHub ignores harmlessly).
3. **Settings → Pages → Build and deployment → Deploy from a branch → main / root → Save**.
4. After a minute the site is at `https://<your-username>.github.io/groundwave-lab/`.

## Option C: Netlify Drop (free, no setup)

Go to https://app.netlify.com/drop and drag this folder in. Create a free account to keep the site permanently.

---

## Fair use of the free map and terrain services

- **OpenStreetMap tiles** (tile.openstreetmap.org) are run by volunteers. They are fine for an educational site with normal traffic. They are not meant for heavy commercial use.
  - Keep the on-map attribution visible.
  - If the site becomes very busy, switch the default style to "OpenStreetMap light" (CARTO) or use a commercial tile key.
  - Usage policy: https://operations.osmfoundation.org/policies/tiles/
- **OpenTopoMap**: free, with attribution (CC-BY-SA).
- **Terrain heights**: Open-Meteo Elevation API (Copernicus DEM GLO-90). It is free for non-commercial use. Credit: "Elevation data: Copernicus DEM GLO-90 via Open-Meteo".
- If a page is opened straight from disk (`file://`), OpenStreetMap's own tile servers refuse it ("Access blocked"). The lab then starts on the CARTO style. Hosting the folder fixes this.

## Accuracy note

This is a teaching model, not a planning tool.

- **Ground wave**: Sommerfeld–Norton with approximate curved-earth loss and Millington mixed paths.
- **Sky wave**: secant law and P.533-style absorption.
- **VHF/UHF**: two-ray model with a radio-horizon loss.
- **Terrain**: single knife-edge (ITU-R P.526).

For licensing or real coverage planning, use ITU-R P.368, P.1147, P.533, P.1546 / P.1812, or professional tools.

---

## Quick usability test (optional, about 30 minutes per person)

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

## Design tokens (for consistent future edits)

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
