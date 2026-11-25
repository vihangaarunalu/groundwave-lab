// Builds the ICARC 2027 manuscript draft (IEEE conference layout, US Letter, two columns).
// Run from docs/icarc2027:  node build_manuscript.js
const fs = require("fs");
const D = require("docx");
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  SectionType, BorderStyle, ShadingType, TabStopType, VerticalAlign } = D;

const FONT = "Times New Roman";
const pt = n => n * 2;                                   // half-points
const COLW = 5040;                                       // one column, DXA (3.5 in)
const FULLW = 10440;                                     // both columns, DXA (7.25 in)

// ---- text helpers: "*italic*", "**bold**", "^sup^", "_sub_" ----
function runs(text, base = {}) {
  const out = []; const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\^[^^]+\^|_\{[^}]+\})/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (t.startsWith("*")) out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: FONT, ...base }));
    else if (t.startsWith("^")) out.push(new TextRun({ text: t.slice(1, -1), superScript: true, font: FONT, ...base }));
    else out.push(new TextRun({ text: t.slice(2, -1), subScript: true, font: FONT, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}
const body = (t, o = {}) => new Paragraph({ children: runs(t, { size: pt(10) }), alignment: AlignmentType.JUSTIFIED, indent: { firstLine: o.noIndent ? 0 : 202 }, spacing: { after: 0, line: 230 }, ...o.p });
const H1 = t => new Paragraph({ children: [new TextRun({ text: t, font: FONT, size: pt(10), smallCaps: true })], alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true });
const H2 = t => new Paragraph({ children: [new TextRun({ text: t, font: FONT, size: pt(10), italics: true })], spacing: { before: 100, after: 40 }, keepNext: true });
const eq = (t, n) => new Paragraph({ children: [...runs(t, { size: pt(10), italics: false }), new TextRun({ text: `\t(${n})`, font: FONT, size: pt(10) })],
  tabStops: [{ type: TabStopType.CENTER, position: 2520 }, { type: TabStopType.RIGHT, position: COLW }], spacing: { before: 60, after: 60 }, indent: { left: 0 } });
const eqc = (t, n) => new Paragraph({ children: [new TextRun({ text: "\t", font: FONT }), ...runs(t, { size: pt(9.5) }), new TextRun({ text: `\t(${n})`, font: FONT, size: pt(10) })],
  tabStops: [{ type: TabStopType.CENTER, position: 2520 }, { type: TabStopType.RIGHT, position: COLW }], spacing: { before: 60, after: 60 } });
const bullet = t => new Paragraph({ children: runs(t, { size: pt(10) }), alignment: AlignmentType.JUSTIFIED, numbering: { reference: "bul", level: 0 }, spacing: { after: 0, line: 230 } });
const caption = (t, center = true) => new Paragraph({ children: runs(t, { size: pt(8) }), alignment: center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, spacing: { before: 60, after: 140 } });
const tcap = (num, t) => [new Paragraph({ children: [new TextRun({ text: `TABLE ${num}`, font: FONT, size: pt(8) })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 }, keepNext: true }),
  new Paragraph({ children: [new TextRun({ text: t, font: FONT, size: pt(8), smallCaps: true })], alignment: AlignmentType.CENTER, spacing: { after: 60 }, keepNext: true })];
function img(file, wIn, keepRatio = true) {
  const buf = fs.readFileSync(file); const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const W = Math.round(wIn * 96), H = Math.round(W * h / w);
  return new Paragraph({ children: [new ImageRun({ type: "png", data: buf, transformation: { width: W, height: H }, altText: { title: file, description: file, name: file } })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 0 }, keepNext: true });
}
const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" }, none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
function table(widths, rows, opt = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, alignment: AlignmentType.CENTER,
    rows: rows.map((r, ri) => new TableRow({ tableHeader: ri === 0, children: r.map((c, ci) => new TableCell({
      width: { size: widths[ci], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 30, bottom: 30, left: 50, right: 50 },
      borders: { top: ri === 0 ? line : none, bottom: (ri === 0 || ri === rows.length - 1) ? line : none, left: none, right: none },
      children: [new Paragraph({ children: runs(String(c), { size: pt(7.5), bold: ri === 0 }), alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })] })) })) });
}
const sp = () => new Paragraph({ children: [new TextRun({ text: "", size: pt(4) })], spacing: { after: 0 } });

// ---------------- data ----------------
const S = Object.fromEntries(fs.readFileSync("data/icarc-summary.csv", "utf8").trim().split("\n").slice(1).map(l => { const c = l.split(","); return [c[0], c.map(Number)]; }));
const f = (v, d = 2) => (+v).toFixed(d);
const SEN = fs.readFileSync("data/icarc-sensitivity.csv", "utf8").trim().split("\n").slice(1).map(l => { const c = l.split(","); return { fac: c[0], v: +c[1], cal: +c[5], sd: +c[6] }; });
const senRow = (fac, label, names) => { const R = SEN.filter(r => r.fac === fac); return [label, R.map((r, i) => names ? names[i] : String(r.v)).join(" / "), R.map(r => f(r.cal, 1)).join(" / ")]; };

// ---------------- title block (one column) ----------------
const title = [
  new Paragraph({ children: [new TextRun({ text: "An Open Digital Shadow for Radio Propagation: Sensor Interface and Simulation-Based Validation Against ITU-R Equations", font: FONT, size: pt(22) })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
  new Paragraph({ children: [new TextRun({ text: "[Author 1], [Author 2], [Supervisor]", font: FONT, size: pt(11) })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
  new Paragraph({ children: [new TextRun({ text: "[Department], [University], [City], Sri Lanka", font: FONT, size: pt(10), italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
  new Paragraph({ children: [new TextRun({ text: "[email addresses]", font: FONT, size: pt(10) })], alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
];

// ---------------- body (two columns) ----------------
const abs = new Paragraph({ children: [new TextRun({ text: "Abstract", font: FONT, size: pt(9), bold: true, italics: true }), new TextRun({ text: "—", font: FONT, size: pt(9), bold: true }),
  ...runs(`Radio propagation prediction is usually taught and planned with closed desktop tools that cannot ingest measurements or show how far a prediction departs from reality. This paper presents an open, browser-based digital shadow for radio propagation that couples ITU-R prediction methods from LF to UHF with a measurement interface through which simulators, physical sensors and third-party applications stream readings. The equation engine was first verified against the ITU-R reference implementation of Recommendation P.1812-6, agreeing within 0.003 dB in basic transmission loss on all 19 official validation profiles. The interface was then validated with an external MATLAB/Octave sensor simulator that sent 2,381 readings in five scenarios. With ideal sensors and the physical conditions assumed by the equations, the readings received through the interface reproduced the equation-only predictions within 0.013 dB. When the simulated environment departed from the equations, least-squares calibration on the received data recovered the hidden offset, building, indoor and distance terms exactly for ideal sensors, and with realistic sensors reduced the root-mean-square error on unseen test points from 7.7 dB to 4.2 dB, close to the 4 dB shadowing floor. A one-factor-at-a-time sensitivity analysis showed that the calibrated error follows the shadowing level and is robust to GPS error, receiver drift, display resolution and lost readings, but requires fast-fading averaging. The results show that data fed through the interface can validate and calibrate the model before real sensors are deployed.`, { size: pt(9), bold: true })],
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 220 } });
const kw = new Paragraph({ children: [new TextRun({ text: "Index Terms", font: FONT, size: pt(9), bold: true, italics: true }), new TextRun({ text: "—digital shadow, digital twin, radio propagation, ITU-R P.1812, sensor interface, model calibration, software-in-the-loop validation, virtual laboratory", font: FONT, size: pt(9), bold: true })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } });

const sec1 = [
  H1("I. Introduction"),
  body("Field-strength prediction underpins the planning of broadcast, mobile and point-to-point radio services. The International Telecommunication Union (ITU-R) publishes the reference methods, from ground-wave propagation at LF and MF [4] and the MF sky wave [5] to path-specific prediction over terrain at VHF and UHF [6]. In education and in first-cut planning, however, these methods are usually applied through desktop software that runs the equations but cannot take in measurements, so the user never sees how far a prediction departs from the real channel or why."),
  body("A digital twin closes this loop by connecting a model to its physical counterpart. Kritzinger *et al.* [1] distinguish three levels: a *digital model* with no automatic data flow, a *digital shadow* in which data flow automatically from the physical object to the model, and a full *digital twin* with automatic flow in both directions. For radio propagation, a digital shadow is the natural first step: measurements flow into the model, the model is compared with them and corrected, and the corrected model is used for prediction."),
  body("This paper reports a prototype of such a digital shadow for radio propagation, built as an open web application that runs in any browser. At this stage the physical sensors are replaced by an external simulator that sends readings through the same interface a real sensor will use. The paper asks two questions: (i) do readings that enter through the interface arrive unchanged and reproduce the equation-only prediction when the sensor and the environment are ideal, and (ii) when the environment departs from the equations, can the received data be used to validate the model and calibrate it?"),
  body("The contributions are:", { noIndent: true }),
  bullet("an open, browser-based platform that integrates ITU-R prediction from LF to UHF around one shared station model, with a measurement interface for simulators, physical sensors and third-party applications;"),
  bullet("verification of the equation engine against the ITU-R reference implementation of P.1812-6 on its 19 validation profiles;"),
  bullet("a software-in-the-loop validation method in five scenarios, from an ideal sensor in ideal conditions to realistic sensors in an environment that follows a different propagation model;"),
  bullet("quantitative evidence that data received through the interface reproduces the equations exactly in the ideal case and supports calibration otherwise."),
];

const sec2 = [
  H1("II. Related Work"),
  H2("A. Propagation prediction methods"),
  body("ITU-R Recommendations define the prediction methods used here: P.368 for the ground wave [4], P.1147 for the MF sky wave [5], P.1812 for point-to-area prediction over terrain from 30 MHz to 6 GHz [6], P.526 for diffraction [7], P.525 for free space [8] and P.530 for the design of line-of-sight links [9], with the refractive index of the atmosphere described in P.453 [10]. The Longley–Rice irregular terrain model [11] is a widely used alternative. These methods are specified as equations and, for P.1812, as reference software, which makes independent verification of an implementation possible."),
  H2("B. Planning and simulation tools"),
  body("Free desktop tools such as Radio Mobile [12] and SPLAT! [13] apply terrain-based models to real maps, and commercial planning suites offer many models and measurement import. These tools target planning rather than teaching, generally run on the desktop, and do not expose the prediction step by step. Table I summarises the gap that this work addresses."),
  H2("C. Digital twins in communications"),
  body("Digital twins originated in manufacturing [1], [2] and are now studied for communication networks, mainly for network management and optimisation [3]. Fewer works address the propagation channel itself as the object of the twin, and fewer still combine standardised prediction, measurement ingestion and teaching."),
  H2("D. Measurement and calibration"),
  body("Field-strength measurements along a route are standardised in ITU-R SM.1708 [16]; local-mean estimation averages fast fading over about 40 wavelengths [14], and slow shadowing is spatially correlated with an exponentially decaying autocorrelation [15]."),
  H2("E. Virtual laboratories"),
  body("Virtual laboratories give students access to experiments that are costly or impractical to run physically, and they are effective when they keep the structure of a real experiment [17], [18]."),
  ...tcap("I", "Comparison with existing approaches"),
  table([1300, 600, 640, 760, 900, 840], [
    ["Approach", "Open, free", "Browser", "ITU-R, LF–UHF", "Measurement interface + calibration", "Teaching features"],
    ["Commercial planning suites", "No", "Varies", "Yes", "Yes", "Limited"],
    ["Free desktop tools [12], [13]", "Yes", "No", "Partly", "No", "Limited"],
    ["Web virtual laboratories [18]", "Yes", "Yes", "No", "No", "Yes"],
    ["Network digital twins [3]", "Varies", "Varies", "No", "Network data", "No"],
    ["This work", "Yes", "Yes", "Yes, verified", "Yes", "Yes"],
  ]),
  sp(),
];

const sec3 = [
  H1("III. System Architecture and Implementation"),
  H2("A. Overview"),
  body("Fig. 1 shows the architecture. Readings from any source enter through a measurement interface, are stored per channel, and are polled by the browser application, which compares them with the equation-only prediction of the ITU-R engine and calibrates the model. All models run in the browser, so the platform needs no installation and scales at no server cost."),
];
const fig1 = [img("figures/fig_architecture.png", 7.0), caption("Fig. 1.  Architecture of the digital shadow: data sources, measurement interface, equation-only engine and calibration.")];
const sec3b = [
  H2("B. Equation engine"),
  body("The engine selects the method by frequency band (Table II). Terrain heights come from the Copernicus GLO-90 digital elevation model and buildings from OpenStreetMap. A receiver is judged either as a broadcast listener, against the minimum field strength for home reception, or as a link receiver, against its sensitivity *S*, using the received power"),
  eqc("*P*_{r} = *E* − 20 log_{10} *f* − 77.2 + *G*_{r} − *L*_{c}", 1),
  body("where *E* is the field strength in dBµV/m, *f* the frequency in MHz, *G*_{r} the receiving antenna gain in dBi and *L*_{c} the cable loss in dB [8].", { noIndent: true }),
  ...tcap("II", "Prediction methods by band"),
  table([1400, 1900, 1740], [
    ["Band / case", "Method", "Standard"],
    ["LF/MF ground wave", "GRWAVE method, Millington mixed paths", "ITU-R P.368 [4]"],
    ["MF sky wave", "Field strength with hourly loss factor", "ITU-R P.1147 [5]"],
    ["VHF/UHF over terrain", "Delta-Bullington diffraction, troposcatter, clutter, building entry", "P.1812-6 [6], P.526 [7], P.2108 [21], P.2109 [22]"],
    ["Line-of-sight links", "Link budget, Fresnel clearance, availability", "P.525 [8], P.530-18 [9]"],
    ["Atmosphere", "Refractivity, effective earth radius", "P.453 [10]"],
  ]),
  sp(),
  H2("C. Shared station model"),
  body("Every view (map, terrain profile, animation, digital shadow) reads and writes one record per station: position, mast height, power, frequency, antenna type and pattern, and, for receivers, height, sensitivity and cable loss. A change in one view therefore appears in all of them, which is the property a digital shadow requires."),
  H2("D. Measurement interface"),
  body("The interface is an HTTPS REST endpoint, /api/measure, implemented as a serverless function. A sender posts JSON to a named channel; a reading carries latitude, longitude, level (field strength in dBµV/m), frequency, antenna height, building and indoor flags, a source label and an optional time stamp, and the channel may carry the transmitter description. Up to 300 readings are accepted per request; the newest 2,000 readings per channel are kept for seven days in an SQL database (Cloudflare D1), with a key–value store as fallback. An optional bearer key restricts who may write. The browser polls the channel every 3 s and adds the readings to the digital shadow."),
  H2("E. Connecting real sensors"),
  body("Three connection paths are supported without changes to the platform:", { noIndent: true }),
  bullet("**Physical socket.** A software-defined radio or field-strength meter connects by serial, USB or TCP socket to a local gateway (for example a single-board computer) that converts samples to field strength and posts them to the interface."),
  bullet("**Third-party application or API.** A smartphone logging application or script reports the serving-cell RSRP, which is converted to field strength using the 3GPP measurement definition [24] and posted; cloud IoT platforms can forward readings through a webhook."),
  bullet("**Remote invocation.** Any program can send readings with a single HTTP request, for example curl, Python or MATLAB webwrite(); the external simulator in this paper uses this path."),
  H2("F. Comparison and calibration"),
  body("For each reading *i* the platform forms the error between the measured level *m*_{i} and the equation-only prediction *p*_{i}, and models it as"),
  eqc("*e*_{i} = *m*_{i} − *p*_{i} = *b*_{0} + *b*_{1}*B*_{i} + *b*_{2}*I*_{i} + *b*_{3} log_{10} *d*_{i} + ε_{i}", 2),
  body("where *B*_{i} and *I*_{i} flag a reading behind a building or indoors, *d*_{i} is the distance in km, *b*_{0} is a system offset (power, cable or antenna error), *b*_{1} and *b*_{2} are building and indoor losses not captured by the model, and *b*_{3} is a distance-trend correction in dB per decade. The coefficients are found by least squares from the normal equations (**X**^T^**X** + λ**I**)**b** = **X**^T^**e** with λ = 10^−6^; a term is omitted when its regressor is constant. Readings are split deterministically into training (about 70%) and test (about 30%) sets, and errors are reported separately on the test set, which is never used in the fit.", { noIndent: true }),
  H2("G. Implementation"),
  body("The client is a single-page web application in plain JavaScript with Canvas rendering (about 11,500 lines), hosted on Cloudflare Pages with continuous deployment from a Git repository; serverless functions provide the measurement interface. Automated browser tests (Playwright) run before each release, and accessibility is checked with axe-core against WCAG 2.1 AA rules. Simulator, sensor scripts and analysis code are published with the platform."),
];

const sec4 = [
  H1("IV. Validation Methodology"),
  H2("A. Verification of the equation engine"),
  body("The platform's P.1812 implementation was run on the 19 terrain profiles of the ITU-R P.1812-6 validation set (95–500 MHz, 1–235 km, both polarisations, rural to dense-urban clutter, line-of-sight and trans-horizon paths) and compared with the results of the reference implementation approved by ITU-R Working Party 3K [19] at 50% time and 50% locations."),
  H2("B. Interface validation with an external simulator"),
  body("A MATLAB/Octave program acts as the sensor network. It reads the measurement points and their equation-only predictions exported by the platform, generates readings under a chosen scenario and posts them to the interface over HTTP, exactly as a real sensor gateway would. The platform then receives the readings, compares them with its own equation-only prediction, calibrates (2) on the training points and evaluates on the test points."),
  body("The simulated reading at point *i* is"),
  eqc("*m*_{i} = *p*'_{i} + Δ_{i} + *s*_{i} + *φ*_{i} + *c* + δ*t*_{i}", 3),
  body("where *p*'_{i} is the level under the simulated reality, Δ_{i} the hidden physical terms of (2), *s*_{i} spatially correlated log-normal shadowing with standard deviation σ and correlation exp(−Δ*x*/*d*_{c}) [15], *φ*_{i} the error of averaging *K* Rayleigh-faded samples in power [14], [23], *c* a receiver calibration error and δ a warm-up drift; the result is quantised to the receiver's display step, positions carry a GPS error, and readings below the receiver sensitivity are dropped.", { noIndent: true }),
  body("Five scenarios were run (Table III). In S0 the sensor is ideal and the simulated environment matches the assumptions of the equations exactly (standard atmosphere, constant conditions, no hidden terms), so the readings should equal the equation values. S1 keeps the ideal sensor but changes the physical conditions. S2 adds realistic sensor effects. In S3 and S4 the reality follows independent models, the close-in free-space reference model with path-loss exponent 3 [20] and an exact two-ray model, so the equations are structurally wrong for the simulated world."),
  body("A sensitivity analysis then started from the realistic sensor of S2 and made one imperfection worse at a time: GPS error (0–25 m), receiver drift (0–5 dB/h), the number *K* of fading samples averaged (none, 1, 10, 40), the display step (0–3 dB), the share of lost readings (0–50%) and the shadowing level (2–6 dB), with four runs per level (84 runs, 6,501 readings)."),
  ...tcap("III", "Validation scenarios"),
  table([480, 1500, 1660, 520, 880], [
    ["", "Simulated reality", "Sensor", "Runs", "Readings"],
    ["S0", "Equations, no hidden terms", "Ideal", "3", "240"],
    ["S1", "Equations + hidden terms", "Ideal", "3", "240"],
    ["S2", "Equations + hidden terms", "Realistic†", "8", "640"],
    ["S3", "Close-in model, n = 3", "Realistic†", "8", "621"],
    ["S4", "Exact two-ray model", "Realistic†", "8", "640"],
  ]),
  caption("Hidden terms: *b*_{0} = −4.0 dB, *b*_{1} = −8.6 dB, *b*_{2} = −3.5 dB, *b*_{3} = −3.2 dB/decade. †Realistic: σ = 4 dB, *d*_{c} = 20 m, *K* = 40, GPS error 3 m, *c* = +1.5 dB, δ = 0.5 dB/h, 1 dB display step, sensitivity −100 dBm. In S3 some readings fell below the sensitivity.", false),
  H2("C. Experimental setting"),
  body("The station was a 433 MHz transmitter on an 18 m mast at the Open University of Sri Lanka campus with an effective radiated power of 2 W and an omnidirectional antenna. The platform generated 160 candidate points within 450 m (64 flagged behind buildings and 22 indoors). Each run drew 80 points at random. To isolate interface and sensor effects, the reported runs used a flat ground at 10 m above sea level and no building geometry, so that the equation-only prediction depended only on the station, distance, antenna pattern and the building and indoor flags. Interface integrity was measured as the largest difference between the level sent and the level received; model agreement as the bias, standard deviation and root-mean-square (RMS) error of *e*_{i}."),
];

const sec5 = [
  H1("V. Results"),
  H2("A. Equation engine"),
  body("On all 19 validation profiles the basic transmission loss agreed with the reference implementation within 0.003 dB (mean −0.000 dB, RMS 0.001 dB). The free-space, Bullington and troposcatter components agreed to 0.000 dB and the spherical-earth diffraction loss to 0.005 dB. The comparison also exposed and corrected two deviations from P.1812-6 in an earlier version: an extra gas and coupling term in the troposcatter loss (about 0.5 dB on a 96 km path) and horizon angles computed with clutter instead of bare terrain."),
  H2("B. Interface integrity"),
  body("All 2,381 readings sent by the simulator were received by the platform. The largest difference between the level sent and the level received was below 0.001 dB, the resolution of the exported values, so the interface transfers readings without loss of accuracy. In the local test deployment each run was visible in the browser within 125 ms; in operation the 3 s polling interval bounds the delay."),
  H2("C. Ideal sensor in the conditions of the equations (S0)"),
  body(`With an ideal sensor and an environment that matches the assumptions of the equations, the readings received through the interface reproduced the equation-only predictions: the largest absolute difference over 240 readings was ${f(S.S0[8], 3)} dB and the RMS difference ${f(S.S0[6], 3)} dB, both explained by the rounding of the exported coordinates and values (Fig. 2a). This confirms that, when the sensor is ideal and represents the exact physical conditions, the measured result equals the result of the equation.`),
];
const fig2 = [img("figures/fig_interface_vs_equation.png", 3.3), caption("Fig. 2.  Level received through the interface versus the equation-only prediction: (a) ideal sensor in the conditions of the equations (S0); (b) realistic sensor with hidden physical terms (S2). Dashed line: equality.")];
const sec5b = [
  H2("D. Ideal sensor, different physical conditions (S1)"),
  body(`When the simulated environment contained the hidden terms, the equation-only prediction showed a bias of ${f(S.S1[4], 1)} dB and an RMS error of ${f(S.S1[6], 1)} dB (${f(S.S1[9], 1)} dB on the test points). Calibration on the received training data recovered every hidden term exactly: offset −4.00 dB, building loss −8.60 dB, indoor loss −3.50 dB and distance trend −3.20 dB/decade (±0.01 dB over three runs), reducing the test RMS error to ${f(S.S1[11], 3)} dB.`),
  H2("E. Realistic sensors (S2–S4)"),
  body(`Table IV and Fig. 3 summarise the realistic scenarios. In S2, calibration reduced the test RMS error from ${f(S.S2[9], 1)} dB to ${f(S.S2[11], 2)} ± ${f(S.S2[12], 2)} dB over eight runs, close to the 4 dB standard deviation of the simulated shadowing, which no deterministic correction can remove. The training and test errors were similar (${f(S.S2[10], 2)} and ${f(S.S2[11], 2)} dB), indicating that the four-term correction did not overfit. When the reality followed an independent model, the equation-only error was large, ${f(S.S3[9], 1)} dB for the close-in model (S3) and ${f(S.S4[9], 1)} dB for the two-ray model (S4), and calibration reduced it to ${f(S.S3[11], 1)} and ${f(S.S4[11], 1)} dB. The two-ray reality left a larger residual because its interference pattern is not linear in log-distance.`),
  ...tcap("IV", "Error of the equation-only prediction and of the calibrated digital shadow (dB)"),
  table([520, 760, 700, 760, 860, 1000], [
    ["", "Bias, equation", "σ, equation", "RMS test, equation", "RMS train, calibrated", "RMS test, calibrated"],
    ...["S0", "S1", "S2", "S3", "S4"].map(k => [k, f(S[k][4], k === "S0" ? 3 : 2), f(S[k][5], k === "S0" ? 3 : 2), f(S[k][9], k === "S0" ? 3 : 2), f(S[k][10], k === "S0" || k === "S1" ? 3 : 2), (k === "S0" || k === "S1" ? f(S[k][11], 3) : f(S[k][11], 2) + " ± " + f(S[k][12], 2))]),
  ]),
  caption("Means over the runs of Table III; ± is the standard deviation between runs. Test points (about 30%) were never used in the fit.", false),
];
const fig3 = [img("figures/fig_rms_by_scenario.png", 3.2), caption("Fig. 3.  RMS error on test points for the equation-only prediction and for the calibrated digital shadow in each scenario. Error bars: standard deviation over runs.")];
const sec5c = [
  body("With realistic sensors the recovered coefficients scattered around the true values (S2, mean ± standard deviation over eight runs): offset −2.22 ± 1.89 dB against −2.17 dB (the hidden −4.0 dB plus the receiver calibration error and the mean drift), building loss −8.51 ± 1.55 dB against −8.6 dB, indoor loss −3.66 ± 2.11 dB against −3.5 dB and trend −3.97 ± 2.39 dB/decade against −3.2. The offset and trend are strongly correlated when all points lie within about one decade of distance; the prediction error remains low, but the two terms are individually uncertain. Fig. 4 shows the full error distribution on the S2 test points."),
];
const fig4 = [img("figures/fig_error_cdf_s2.png", 3.2), caption("Fig. 4.  Cumulative distribution of the error on S2 test points before and after calibration.")];

const sec5d = [
  H2("F. Sensitivity to sensor imperfections"),
  body("Table V and Fig. 5 show the test error after calibration when one sensor imperfection is made worse at a time. The residual error followed the shadowing level almost exactly (2.1, 4.1 and 6.2 dB for σ = 2, 4 and 6 dB), confirming that shadowing sets the accuracy floor. GPS errors up to 25 m, drift up to 5 dB/h, a 3 dB display step and the loss of half the readings changed the error by less than 1 dB, within the run-to-run variation. The one critical factor was fast-fading averaging: a single unaveraged sample (*K* = 1) raised the error to 7.5 ± 2.6 dB, whereas averaging 10 or 40 samples kept it at about 4.6 dB, in line with the local-mean averaging rule [14]."),
  ...tcap("V", "Test RMS error after calibration with one sensor imperfection made worse at a time (dB)"),
  table([1700, 1500, 1840], [
    ["Imperfection", "Levels", "Test RMS error"],
    senRow("gps_m", "GPS error (m)"),
    senRow("drift_db_h", "Receiver drift (dB/h)"),
    senRow("fade_k", "Fading samples averaged, *K*", ["none", "1", "10", "40"]),
    senRow("quant_db", "Display step (dB)", ["0", "1", "3"]),
    senRow("loss_pct", "Readings lost (%)"),
    senRow("shadow_db", "Shadowing σ (dB)"),
  ]),
  caption("Other settings as the realistic sensor of S2; mean of four runs per level.", false),
];
const fig5 = [img("figures/fig_sensitivity.png", 3.2), caption("Fig. 5.  Test RMS error after calibration versus each sensor imperfection (mean ± standard deviation over four runs).")];
const sec6 = [
  H1("VI. Discussion"),
  H2("A. What the results show"),
  body("The experiments answer the two questions posed in Section I. The measurement interface transferred every reading without loss of accuracy, and with an ideal sensor in the conditions assumed by the equations (S0) the readings received through the interface reproduced the equation-only prediction to within the rounding of the exported values. S0 therefore acts as a null test, comparable to a loopback test in a communication link: once it passes, any difference observed later with real sensors can be attributed to the sensor or to the environment, not to the interface or to the implementation of the equations."),
  body("When the simulated environment departed from the equations but the sensor remained ideal (S1), calibration recovered every hidden term exactly. This shows that the four-term correction (2) is identifiable and unbiased: given noise-free data, it returns the physical quantities that caused the departure. With realistic sensors (S2) the test error fell to 4.2 dB, close to the 4 dB standard deviation of the simulated shadowing. Calibration removes the systematic part of the error, such as a wrong power, a missing building loss or a wrong distance slope, but it cannot remove spatially random shadowing, so the residual indicates the best accuracy a site-specific model can reach with the given sensors. Training and test errors were similar, which shows that the correction did not overfit."),
  body("When the simulated world followed a different propagation model (S3, S4), the equation-only error was large, yet calibration brought it close to the shadowing floor within the measured area. The digital shadow can therefore correct a structurally wrong model where measurements exist; this does not justify extrapolating beyond the measured distance range. The larger residual of the two-ray case shows the limit of a linear correction: when the true behaviour is oscillatory, a different model must be selected rather than only corrected."),
  H2("B. Why simulation-based validation at this stage"),
  body("The validation used simulated sensors by design. A simulator provides the exact ground truth, so the interface and the calibration can be judged against known values, which field measurements cannot provide. It also allows each effect (shadowing, fading, GPS error, receiver drift) to be switched on alone and every run to be repeated with the same random seed. Because the simulator uses the same interface as a physical sensor, replacing it with real sensors requires no change to the platform. Simulation-based validation therefore establishes the correctness of the data path and of the method before field campaigns, in which errors from many sources are mixed."),
  H2("C. Practical implications"),
  body("The sensitivity analysis gives design rules for the sensor network. Shadowing, not the sensor, sets the accuracy floor, so low-cost sensors with modest GPS and calibration accuracy are adequate, provided that each reading averages fast fading over many samples; a single instantaneous sample degrades the result markedly. The strong correlation between the fitted offset and the distance trend over about one decade of distance adds a further rule: sensors and walk-test points should span a wide range of distances so that the two terms can be separated. For teaching, the platform lets students see why a measurement differs from a prediction, using the same equations they study; because it runs in a browser without a licence, it also supports first-cut planning in institutions without access to commercial tools."),
  H2("D. Limitations and threats to validity"),
  body("The conclusions depend on the sensor model: shadowing was assumed log-normal with exponential spatial correlation and fast fading Rayleigh, and real sensors may show non-Gaussian errors or antenna effects. The runs used one station, one frequency (433 MHz), flat terrain and no building geometry; the calibration model has four terms; and timing was measured on a local deployment. P.1812 is implemented for 50% time only, and smartphone RSRP has limited absolute accuracy [24]. These limits concern how far the results generalise, not the correctness of the interface or the method, and are addressed by the field validation planned in Section VII."),
];
const sec7 = [
  H1("VII. Conclusion and Future Work"),
  body("An open, browser-based digital shadow for radio propagation was presented and validated. The equation engine agrees with the ITU-R P.1812-6 reference implementation within 0.003 dB, and an external simulator demonstrated that readings fed through the measurement interface reproduce the equation-only prediction exactly for ideal sensors and support calibration that recovers hidden physical terms and reduces the test error to the shadowing floor for realistic sensors. Future work will connect software-defined-radio sensors and smartphones in field campaigns on the university campus and along a broadcast link, compare the calibrated model with measurements on real terrain, add time-percentage support to P.1812, and evaluate the platform with students."),
  H1("Acknowledgment"),
  body("[Acknowledge the supervisor, institutions and data providers.] The authors used AI tools to assist in developing parts of the software and in drafting this manuscript; the authors verified all models, results and references and take full responsibility for the content.", { noIndent: true }),
];

const refs = [
  "W. Kritzinger, M. Karner, G. Traar, J. Henjes, and W. Sihn, “Digital twin in manufacturing: A categorical literature review and classification,” *IFAC-PapersOnLine*, vol. 51, no. 11, pp. 1016–1022, 2018.",
  "M. Grieves and J. Vickers, “Digital twin: Mitigating unpredictable, undesirable emergent behavior in complex systems,” in *Transdisciplinary Perspectives on Complex Systems*. Cham, Switzerland: Springer, 2017, pp. 85–113.",
  "P. Almasan *et al.*, “Network digital twin: Context, enabling technologies, and opportunities,” *IEEE Commun. Mag.*, vol. 60, no. 11, pp. 22–27, Nov. 2022.",
  "*Ground-wave propagation prediction method for frequencies between 10 kHz and 30 MHz*, Rec. ITU-R P.368, ITU, Geneva.",
  "*Prediction of sky-wave field strength at frequencies between about 150 and 1 700 kHz*, Rec. ITU-R P.1147, ITU, Geneva.",
  "*A path-specific propagation prediction method for point-to-area terrestrial services in the frequency range 30 MHz to 6 000 MHz*, Rec. ITU-R P.1812-6, ITU, Geneva, 2021.",
  "*Propagation by diffraction*, Rec. ITU-R P.526, ITU, Geneva.",
  "*Calculation of free-space attenuation*, Rec. ITU-R P.525, ITU, Geneva.",
  "*Propagation data and prediction methods required for the design of terrestrial line-of-sight systems*, Rec. ITU-R P.530-18, ITU, Geneva, 2021.",
  "*The radio refractive index: its formula and refractivity data*, Rec. ITU-R P.453, ITU, Geneva.",
  "A. G. Longley and P. L. Rice, “Prediction of tropospheric radio transmission loss over irregular terrain: A computer method—1968,” ESSA Tech. Rep. ERL 79-ITS 67, U.S. Dept. of Commerce, 1968.",
  "R. Coudé, “Radio Mobile,” software. [Online]. Available: [URL, accessed date]",
  "J. A. Magliacane, “SPLAT! RF signal propagation, loss, and terrain analysis tool,” software. [Online]. Available: [URL, accessed date]",
  "W. C. Y. Lee, “Estimate of local average power of a mobile radio signal,” *IEEE Trans. Veh. Technol.*, vol. 34, no. 1, pp. 22–27, Feb. 1985.",
  "M. Gudmundson, “Correlation model for shadow fading in mobile radio systems,” *Electron. Lett.*, vol. 27, no. 23, pp. 2145–2146, Nov. 1991.",
  "*Field-strength measurements along a route with geographical coordinate registrations*, Rec. ITU-R SM.1708, ITU, Geneva.",
  "T. de Jong, M. C. Linn, and Z. C. Zacharia, “Physical and virtual laboratories in science and engineering education,” *Science*, vol. 340, no. 6130, pp. 305–308, 2013.",
  "Virtual Labs, Ministry of Education, Government of India. [Online]. Available: https://www.vlab.co.in [accessed date]",
  "I. Stevanovic, “MATLAB/Octave implementation of Recommendation ITU-R P.1812-6,” software, v6.0, Zenodo, doi: 10.5281/zenodo.6141558.",
  "T. S. Rappaport, G. R. MacCartney, M. K. Samimi, and S. Sun, “Wideband millimeter-wave propagation measurements and channel models for future wireless communication system design,” *IEEE Trans. Commun.*, vol. 63, no. 9, pp. 3029–3056, Sep. 2015.",
  "*Clutter and building entry loss*: *Prediction of clutter loss*, Rec. ITU-R P.2108, ITU, Geneva.",
  "*Prediction of building entry loss*, Rec. ITU-R P.2109, ITU, Geneva.",
  "R. H. Clarke, “A statistical theory of mobile-radio reception,” *Bell Syst. Tech. J.*, vol. 47, no. 6, pp. 957–1000, 1968.",
  "*Evolved Universal Terrestrial Radio Access (E-UTRA); Physical layer; Measurements*, 3GPP TS 36.214.",
];
refs[20] = "*Prediction of clutter loss*, Rec. ITU-R P.2108, ITU, Geneva.";
const refBlock = [H1("References"), ...refs.map((r, i) => new Paragraph({ children: [new TextRun({ text: `[${i + 1}]\t`, font: FONT, size: pt(8) }), ...runs(r, { size: pt(8) })],
  tabStops: [{ type: TabStopType.LEFT, position: 360 }], indent: { left: 360, hanging: 360 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 30 } }))];

// ---------------- document ----------------
const page = { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1440, left: 900, right: 900 } };
const twoCol = { column: { count: 2, space: 360, equalWidth: true } };
const doc = new Document({
  creator: "[Authors]", title: "ICARC 2027 manuscript draft",
  styles: { default: { document: { run: { font: FONT, size: pt(10) } } } },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: D.LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 288, hanging: 202 } } } }] }] },
  sections: [
    { properties: { page }, children: title },
    { properties: { page, type: SectionType.CONTINUOUS, ...twoCol }, children: [abs, kw, ...sec1, ...sec2, ...sec3] },
    { properties: { page, type: SectionType.CONTINUOUS }, children: fig1 },
    { properties: { page, type: SectionType.CONTINUOUS, ...twoCol }, children: [...sec3b, ...sec4, ...sec5, ...fig2, ...sec5b, ...fig3, ...sec5c, ...fig4, ...sec5d, ...fig5, ...sec6, ...sec7, ...refBlock] },
  ],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync("ICARC2027_manuscript_draft.docx", b); console.log("written"); });
