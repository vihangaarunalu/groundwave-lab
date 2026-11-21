# Groundwave Propagation Lab: public website

This folder is a complete static website. Upload it to any free static host to get a public link that anyone can open.

- `index.html`: the whole app (Lab, Animation, Map & location, Cellular, Models, Learn, Quiz).
- `assets/`: the favicon set, the mast photograph used on the home screen and the KaTeX stylesheet and fonts that typeset the equations. **Upload this folder together with `index.html`**, or the hero photo and the equations will not display correctly.
- **Tutor tools**: an Equation editor (Models tab, or *Open the equation editor* under a custom formula in the Lab) typesets a formula as you type, checks and plots it, adds it to the Lab as a model, and writes free LaTeX with copy-as-MathML for Word and a full-screen *Present* view. A guided tour (hero, Help, or the first-run note) walks through every tab.
- `feedback.html`: the staff Feedback inbox (passphrase protected; see SETUP.md).
- `functions/api/`: the visit counter and feedback storage (Cloudflare Pages Functions).
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

## Live link (Digital shadow tab)

The Digital shadow tab can receive readings live from any program, today a
MATLAB sensor emulator (software-in-the-loop), later the real SDR sensors.

- Endpoint: `functions/api/measure.js` → `/api/measure?ch=<channel>`
  (POST JSON readings, GET `?since=` to read them back). It uses the same
  `VISITS` KV binding as the feedback inbox. Optional secret `MEASURE_KEY`
  makes senders add `Authorization: Bearer <key>`.
- MATLAB script: `assets/wisdom_sensor_emulator.m` (R2016b or newer). Set
  `CHANNEL` to the name in the Live link panel, press Connect on the page,
  then Run. It uses an independent model with injected losses and sensor
  errors, and prints what the calibration should recover.
- Reading format: `{sensor, lat, lon, level (dBµV/m), h, built, indoor, fixed, src}`;
  optional `tx: {name, lat, lon, h, f_mhz, erp_kw}` sets the modelled station.

### Digital shadow v9 features
- Drag the tower, sensors and walk points; add sensors (N) or walk points (M) by clicking.
- Real buildings from OpenStreetMap (zoom to street level): for every point the path from
  the tower is checked for buildings (rooftop diffraction, ITU-R P.526 knife edge, two
  strongest edges) and indoor points get building entry loss (ITU-R P.2109). Click a
  building to set its real height and construction type (saved in the browser).
- Calibration learns offset, extra building loss, extra indoor loss and distance trend;
  optional hold-out (30% of points never used for fitting); saved results with CSV export.
- Planning mode: moving the tower away from where uploaded/live data were measured shows
  predictions only, until "Back to the measured station".
- Saved layouts (station, sensors, walk route) in the browser.
- MATLAB emulator: exact sensor coordinates (`P_TABLE`), separate indoor flag, and
  `SYNC_TX` follows the tower when it is dragged on the website while connected.

## Experiments with the MATLAB sensor model (v9.3)

Software-in-the-loop experiments, no hardware needed (Shadow tab, card "Experiments with the MATLAB sensor model"):

1. On the page: **Export points for MATLAB** saves `wisdom-plan.csv` (a pool of 160 points with this page's own model values).
2. In MATLAB (R2016b+) or Octave (7+): run `assets/wisdom_experiments.m` next to that file. It hides known errors
   (offset, building loss, indoor loss, distance trend) and adds a realistic sensor model (correlated shadowing,
   Rayleigh fading with 40λ averaging, GPS error, receiver calibration error and drift, 1 dB display, sensitivity, lost readings).
   It writes `wisdom-experiments.csv` and the hidden answers `wisdom-truth.csv`.
3. On the page: **Run wisdom-experiments.csv** calibrates every case with the same least-squares fit as the Calibrate
   button and a fixed hold-out test set; **Download results** saves `wisdom-results.csv`.
4. In MATLAB: `MODE = 'plots'` compares the results with the hidden answers and writes `wisdom-paper-tables.txt`
   and `wisdom-E1.png` … `wisdom-E4.png`.

Experiments: E1 recover the hidden errors, E2 readings needed vs shadowing, E3 reality from an independent model
(3GPP close-in, two-ray), E4 GPS error, drift, fading, lost readings and display rounding one at a time.
`MODE = 'live'` streams one realistic sensor to the Live link for demonstrations.

## Experiments tab and gentle start (v9.4)

- **Experiments** (tab 0): five virtual-lab experiments in the Aim, Theory, Pre-test, Procedure, Simulation,
  Observations, Post-test and References format: HF skip distance, two-ray ground reflection, knife-edge
  diffraction, fading channels (Clarke/Jakes, Rayleigh and Rician, with level crossing rate and fade duration
  against theory) and digital shadow calibration. Each has "Show me" hints, an observation table with an
  automatic sweep, CSV export, a printable lab sheet and references. Progress is saved in the browser.
- **Welcome card** for first-time visitors with four starting points (learn, experiment, plan a station,
  research), plus a guide for the Experiments tab (press G).
- **Paper support:** `docs/PAPER_NOTES.md` (models and standards table, verification, limitations, BibTeX).

## Phone measurements (v9.5)

Real 4G measurements with no extra hardware (Shadow tab, card "Phone measurements"):

- Record a walk with an Android logging app (G-NetTrack Lite, NetMonster, Network Cell Info Lite), export the log
  and load it. Columns (latitude, longitude, signal, cell, EARFCN) are recognised automatically and can be changed.
- Keep only the serving cell; the frequency comes from the EARFCN (bands 1, 3, 5, 7, 8, 20, 28, 38, 40, 41).
- RSRP → total power (+10·log10(12·N_RB)) → field strength (+20·log10 f + 77.2 − G); averaged in power every 40 λ.
- Phone readings are diamonds on the map; "Show" filters readings by source (simulated, MATLAB/live, phone, CSV),
  and Calibrate then fits only those. "Estimate the tower power" sets the unknown tower ERP from the median reading.
- Live streaming from the phone: `assets/wisdom_phone_live.sh` (Termux + Termux:API) sends RSRP-derived field
  strength and GPS to the live link every few seconds.
- Experiments tab: experiment 6, "Real 4G measurement with a smartphone".

## Propagation types, explain-on-G and standards (v9.6)

- **Animation tab:** a visual picker with five propagation types, each animated from its equations and cited to its standard:
  line of sight (ITU-R P.525, P.526, P.530; 4/3 earth, radio horizon), reflection (two-ray, ground constants ITU-R P.527),
  refraction (k-factor from the refractivity gradient: standard −40 N/km, super-refraction below −79, ducting below
  −157 N/km, ITU-R P.453 and P.834), diffraction (ITU-R P.526 knife edge), and ground and sky wave.
- **Guide:** an animated hand glides to each step. Point at any chart or control (or focus it) and press **G** for a
  "What is this?" explanation; elsewhere G opens the page guide.
- **Experiments:** animated pulses along the rays, clear legends and distinct ray colours; references now include
  ITU-R P.525, P.530, P.1057, P.1406 and 3GPP TS 36.101.

## Animate a real map path (v9.7)

Place a transmitter and receivers on the Map (for example Colombo → Yatiyantota, and a second receiver behind a
mountain), then press **Animate it** (or **Animate my map path** in the Animation tab). For VHF/UHF the Animation shows
the real terrain and buildings between the two sites on an effective earth, with the antenna heights from the map
(drag the dots or use the sliders to change them), and opens in line of sight when the path is clear or in diffraction
when it is blocked. Switch the type to present the same path as line of sight, reflection (specular point on the real
profile, ITU-R P.527 constants), refraction (k = 2/3 … ducting, ITU-R P.453 / P.834) or diffraction (knife edges,
Deygout with J(ν), ITU-R P.526). Every type shows the same clearance chart in Fresnel zones (0.6 criterion, ITU-R P.526 /
P.530), free-space loss (ITU-R P.525) and the Map's own ITU-R P.1812 delta-Bullington result for comparison.

## Antennas for transmitters and receivers (v9.8)

- New VHF/UHF antenna types: corner reflector (90°), parabolic dish (main lobe 2·J1(u)/u, sidelobes on the
  ITU-R F.699 envelope 32 − 25·log10 φ dBi), and quarter-wave ground plane / whip; alongside the existing half-wave
  dipole, multi-bay omni, panel, Yagi–Uda and log-periodic (ITU-R BS.1195) and the LF/MF masts (ITU-R BS.1386).
- Every antenna has a labelled sketch of its physical shape, a "how it works" line, its size at the operating
  frequency, and its real horizontal and vertical patterns.
- **Receivers** now have their own settings panel (Map → Receiver sites → Antenna button, or select a receiver and
  press P): antenna height, cable loss, antenna type with sketch and patterns, automatic pointing at the transmitter,
  gain towards the transmitter, and the power at the receiver input E − 20·log f − 77.2 + G − loss (ITU-R P.525).
  Planning references for receiving-antenna directivity: ITU-R BT.419 (TV) and BS.599 (FM).

## Point-to-point links in the Animation (v9.9)

For a VHF/UHF map path (for example a 30 W studio-transmitter link from Colombo to a 100 m tower at Yatiyantota,
Yagi–Uda at both ends) the Animation draws the real antennas on the masts with their main beams, the signal moving along
the line of sight over the real terrain, and a link budget (ITU-R P.525): transmitter power, feeder loss, transmit
antenna gain towards the receiver, free-space and terrain loss, receive antenna gain, cable loss, received power and the
margin over the receiver sensitivity. Antenna types (with sketches) for both ends can be chosen in the scene settings,
and "Point the transmitter antenna at this receiver" aims a directional antenna. The propagation-type buttons show
whether each type applies to this path ("on this path" / "not on this path"); choosing ground and sky wave on a VHF/UHF
path explains why it does not apply and keeps the line-of-sight view. The Shadow tab's station antenna also has a sketch
and more types (corner reflector, dish, whip).

## One animation for every propagation type (v10.0)

When a VHF/UHF map path is animated, line of sight, reflection, refraction and diffraction are drawn inside the same
curved-earth animation as the ground and sky wave: real terrain and buildings, masts at their true heights, the
antennas with their beams, the Fresnel zone, the moving signal, and a draggable receiver (distance slider) with the
same signal readout. In this link view the readout judges the link by received power: the field strength needed is
worked out from the receiver sensitivity, antenna gain and cable loss. A live box shows the mathematics step by step
(EIRP, free-space loss ITU-R P.525, terrain loss ITU-R P.526 / clearance P.530, field strength, received power and
margin; k-factor for refraction, two-ray terms for reflection). The view zooms to the link when it opens.

## v10.1: one chooser, link judgement everywhere

- The propagation type is chosen in one control (Ground & sky, Line of sight, Reflection, Refraction, Diffraction),
  in the stage bar and in the full-screen bar; a green dot marks the types that describe the chosen map path.
- On a VHF/UHF map path every type runs in the curved-earth view on the user's terrain, with sky-wave-style animated
  rays; Ground & sky is still shown but judged "Not this mechanism", never "no reliable signal".
- The live maths panel (hide/show) sits beside the zoom buttons; at the map receiver's own position the terrain loss
  is the Map's ITU-R P.1812 delta-Bullington value, elsewhere ITU-R P.526 J(ν); it warns when the transmit antenna is
  not aimed at the receiver and aims it in one click.
- Terrain for the animation is sampled at up to 400 points (was 160) so peaks are not missed.

## v10.2: full-screen polish

- Full-screen control bar is one slim row (the propagation buttons no longer stack) and fades out after 3.5 s without
  movement; any move, tap or key brings it back. The earth is lifted above the bar so the ground and terrain stay visible.
- Antenna sketches in the scene settings no longer overlap their labels; at LF/MF/HF there is no receiving antenna to
  choose (the field strength is what counts), so the receiver antenna chooser is replaced by a note.
