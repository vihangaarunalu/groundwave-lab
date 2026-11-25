// Builds the ICARC 2027 EDUCATION-TRACK manuscript (IEEE conference layout, US Letter, two columns).
// Run from docs/icarc2027:  node build_manuscript_edu.js
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
const OUTFILE = "ICARC2027_education_manuscript.docx";

// ===================== EDUCATION-TRACK MANUSCRIPT CONTENT =====================
// Prepended at build time with the shared helpers (lines 1-60 of build_manuscript.js).
function tableL(widths, rows) {   // text table, left-aligned cells
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, alignment: AlignmentType.CENTER,
    rows: rows.map((r, ri) => new TableRow({ tableHeader: ri === 0, cantSplit: true, children: r.map((c, ci) => new TableCell({
      width: { size: widths[ci], type: WidthType.DXA }, margins: { top: 25, bottom: 25, left: 45, right: 45 },
      borders: { top: ri === 0 ? line : none, bottom: (ri === 0 || ri === rows.length - 1) ? line : none, left: none, right: none },
      children: [new Paragraph({ children: runs(String(c), { size: pt(7.5), bold: ri === 0 }), alignment: AlignmentType.LEFT })] })) })) });
}

const TITLE = "Applying the Digital Shadow Concept to Wireless Communication Education: A Browser-Based, ITU-R-Verified Learning Environment";
const title = [
  new Paragraph({ children: [new TextRun({ text: TITLE, font: FONT, size: pt(22) })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
  new Paragraph({ children: [new TextRun({ text: "[Author 1], [Author 2], [Supervisor]", font: FONT, size: pt(11) })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
  new Paragraph({ children: [new TextRun({ text: "[Department], [University], [City], Sri Lanka", font: FONT, size: pt(10), italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
  new Paragraph({ children: [new TextRun({ text: "[email addresses]", font: FONT, size: pt(10) })], alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
];

const abs = new Paragraph({ children: [new TextRun({ text: "Abstract", font: FONT, size: pt(9), bold: true, italics: true }), new TextRun({ text: "—", font: FONT, size: pt(9), bold: true }),
  ...runs(`Students of wireless communication learn propagation through equations but rarely see why real measurements depart from them, because radio-frequency laboratories and field campaigns are costly. This paper applies the digital shadow concept, in which data flow automatically from a physical system into its model, to wireless communication education. A browser-based learning environment couples ITU-R prediction methods from LF to UHF with a measurement interface that accepts digital sensor readings from simulators, physical sensors, smartphones, files and live environmental services, so that students can predict, observe, explain and calibrate the gap between theory and measurement. The paper describes the existing work the environment builds on, the data-integration methods and a seven-laboratory learning sequence mapped to course topics and cognitive levels. To show that the environment is trustworthy for teaching, its P.1812-6 implementation was verified against the ITU-R reference implementation (within 0.003 dB on 19 profiles), and an external MATLAB/Octave sensor simulator sent 2,381 readings through the interface: ideal sensors reproduced the equations within 0.013 dB, calibration recovered hidden physical effects exactly, and with realistic sensors the error fell from 7.7 dB to the 4 dB shadowing floor. A classroom evaluation is planned.`, { size: pt(9), bold: true })],
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 220 } });
const kw = new Paragraph({ children: [new TextRun({ text: "Index Terms", font: FONT, size: pt(9), bold: true, italics: true }), new TextRun({ text: "—digital shadow, wireless communication education, radio propagation, virtual laboratory, active learning, sensor interface, ITU-R P.1812", font: FONT, size: pt(9), bold: true })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } });

const sI = [
  H1("I. Introduction"),
  body("Radio propagation is a core topic of wireless communication courses: free-space loss, diffraction over terrain, Fresnel-zone clearance, reflection, shadowing, multipath fading and the link budget determine whether a broadcast, mobile or point-to-point service works. Students meet these topics as equations [1], [2]. What they rarely meet is the engineer's daily question: *why does the measurement differ from the prediction, and what does the difference tell us?*"),
  body("Answering that question normally requires a radio-frequency laboratory or a field campaign: transmitters, calibrated receivers, spectrum analysers, vehicles and staff time. Many institutions, particularly in developing countries, cannot provide them at the scale of a full class. Simulation software fills part of the gap, but most tools compute only the equation side; students see a coverage map, not the departure of reality from it."),
  body("Digital twins offer a way to close this gap. Kritzinger *et al.* [3] distinguish a *digital model* (no automatic data flow), a *digital shadow* (automatic flow from the physical object to the model) and a *digital twin* (automatic flow in both directions). A digital shadow of a radio channel continuously compares the model with readings from the field and corrects it. This paper argues that the same loop is a powerful learning design: students predict with the equations, observe readings, explain the difference in physical terms and calibrate the model, which is the cycle that professional radio planners follow."),
  body("We present a browser-based learning environment that applies this concept to wireless communication education. Because the measurement interface accepts readings from a simulator as well as from physical sensors, the full loop can be taught without any radio hardware, and real sensors can be added later without changing the environment. The contributions are:", { noIndent: true }),
  bullet("the application of the digital shadow concept to wireless communication education, with a learning cycle grounded in Predict–Observe–Explain and experiential learning;"),
  bullet("an open, browser-based environment with ITU-R prediction from LF to UHF and six data-integration methods, from digital sensor readings through an API to live environmental data;"),
  bullet("a seven-laboratory sequence mapped to course topics and cognitive levels;"),
  bullet("evidence that the environment is trustworthy for teaching: verification against the ITU-R reference implementation and validation of the data path with an external sensor simulator."),
];

const sII = [
  H1("II. Existing Work"),
  H2("A. Teaching radio propagation"),
  body("Textbooks present propagation through deterministic and statistical models: free space and two-ray models, knife-edge diffraction, log-normal shadowing and Rayleigh fading [1], [2], [4]. The International Telecommunication Union standardises the planning methods, for example ground-wave prediction (P.368) [5], path-specific prediction over terrain at VHF and UHF (P.1812) [6], diffraction (P.526) [7], free space (P.525) [8] and the design of line-of-sight links (P.530) [9]. These methods are precise but abstract; without measurements students cannot see which terms matter in practice."),
  H2("B. Virtual and remote laboratories"),
  body("Virtual laboratories give students access to experiments that are costly or impractical to run physically, and they support learning comparably to physical laboratories when the experimental reasoning is preserved [10]. National initiatives such as Virtual Labs provide simulations in an Aim–Theory–Procedure–Simulation format [11]. Active-learning approaches, in which students engage with problems instead of listening passively, improve performance in science and engineering [12]. Predict–Observe–Explain (POE) asks students to commit to a prediction before observing [13], and Kolb's experiential learning cycle moves from concrete experience through reflection and conceptualisation to active experimentation [14]."),
  H2("C. Digital twins and digital shadows"),
  body("Digital twins originated in manufacturing [3], [15] and are now studied for communication networks, mainly for network management and optimisation [16]. In education they are emerging as a way to connect theory with the behaviour of real systems; for the radio channel, however, combining standardised prediction, measurement ingestion and teaching in one environment remains uncommon."),
  H2("D. Planning tools"),
  body("Free and commercial planning tools such as Radio Mobile [17] and SPLAT! [18] apply terrain-based models to real maps and are valuable for planning, but they target practitioners, run mostly on the desktop and show the equation side only. Table I summarises how the main approaches support the learning goal of this work."),
  ...tcap("I", "How existing approaches support learning the theory–measurement gap"),
  tableL([1340, 640, 800, 760, 820, 680], [
    ["Approach", "Shows theory", "Shows measured reality", "Explains the gap", "RF equipment needed", "Scales to a class"],
    ["Textbook exercises", "Yes", "No", "No", "No", "Yes"],
    ["Equation-only simulators and planning tools", "Yes", "No", "No", "No", "Yes"],
    ["Physical RF laboratory", "Partly", "Yes", "With tutor", "Yes", "Limited"],
    ["Remote or virtual laboratory", "Yes", "Simulated", "Partly", "No / shared", "Yes"],
    ["Digital shadow environment (this work)", "Yes", "Yes (simulated now, sensors later)", "Yes, by calibration", "No", "Yes"],
  ]),
  sp(),
];

const sIII = [
  H1("III. The Digital Shadow Learning Environment"),
  H2("A. Architecture"),
  body("Fig. 1 shows the environment. Readings from any source enter a measurement interface and are stored per channel; the browser application compares them with the equation-only prediction of an ITU-R engine and calibrates the model. All computation runs in the browser, so a whole class can work at once with no installation and no licence."),
];
const fig1 = [img("figures/fig_architecture.png", 7.0), caption("Fig. 1.  Architecture of the learning environment: data sources, measurement interface, equation-only ITU-R engine and digital shadow.")];
const sIIIb = [
  H2("B. Equation engine"),
  body("The engine selects the method by band: the GRWAVE ground-wave method of P.368 at LF and MF [5], the P.1147 sky wave at MF, P.1812 with delta-Bullington diffraction over terrain at VHF and UHF [6], [7], the P.525 link budget and P.530 clearance and availability for point-to-point links [8], [9], and the refractivity of P.453 for the atmosphere [19]. Terrain comes from the Copernicus GLO-90 elevation model and buildings from OpenStreetMap. Every result can be expanded into its equations step by step, so students see how each number arises."),
  H2("C. Data-integration methods"),
  body("The digital shadow needs data from the physical side. The environment accepts six kinds of input (Table II), all of which reach the same comparison and calibration step:"),
  bullet("**Digital sensor readings through an API.** A REST endpoint, /api/measure, accepts JSON readings on a named channel: latitude, longitude, level in dBµV/m, frequency, antenna height, building and indoor flags, source and time. Up to 300 readings are accepted per request, the newest 2,000 per channel are kept for seven days in an SQL database, an optional key restricts writing, and the browser polls the channel every 3 s. Students can write their own sender in a few lines of Python or MATLAB, which also teaches how sensor networks report data."),
  bullet("**External simulator.** A MATLAB/Octave program plays the sensor network: it creates a hidden reality chosen by the instructor, adds realistic sensor imperfections and sends the readings through the API."),
  bullet("**Physical sensors through a gateway.** A software-defined radio or field-strength meter connects by serial, USB or TCP socket to a gateway that converts samples to field strength and posts them to the API."),
  bullet("**Smartphones.** A logging application records the serving-cell RSRP, which is converted to field strength using the 3GPP definition [20] and the bandwidth; files are imported, or a phone script streams live readings."),
  bullet("**Measurement files.** Earlier walk tests and shared datasets are uploaded as CSV files."),
  bullet("**Live environmental data.** Weather (for the refractivity gradient, rain and soil moisture), space weather (for solar-flare absorption) and terrain are fetched automatically and used as model inputs."),
  ...tcap("II", "Data-integration methods and their classroom use"),
  tableL([1250, 1640, 2150], [
    ["Method", "Connection", "Classroom use"],
    ["Digital sensor readings", "HTTPS REST API, JSON, channel, optional key", "Students write a sender; class-wide live channel"],
    ["External simulator", "MATLAB/Octave → API", "Instructor sets a hidden reality (\"mystery channel\")"],
    ["Physical sensors", "Serial/USB/TCP socket → gateway → API", "Bench or campus sensor station (future)"],
    ["Smartphone", "App CSV import or live script → API", "Campus walk test of a 4G cell"],
    ["Measurement files", "CSV upload", "Reuse of earlier campaigns"],
    ["Environmental data", "Weather, space-weather and terrain services", "Live k-factor, flare absorption, terrain"],
  ]),
  sp(),
  H2("D. Comparison and calibration"),
  body("For each reading the environment forms the error between the measured level *m*_{i} and the equation-only prediction *p*_{i} and fits physically meaningful corrections by least squares:"),
  eqc("*e*_{i} = *m*_{i} − *p*_{i} = *b*_{0} + *b*_{1}*B*_{i} + *b*_{2}*I*_{i} + *b*_{3} log_{10} *d*_{i} + ε_{i}", 1),
  body("where *B*_{i} and *I*_{i} flag readings behind a building or indoors and *d*_{i} is the distance. The terms are a system offset (power, cable or antenna error), building loss, indoor loss and a distance-trend correction, so each fitted value has a physical meaning students can discuss. About 30% of the readings are kept aside as test points, so students also learn to check a model on data it has not seen.", { noIndent: true }),
];

const sIV = [
  H1("IV. Interactive Learning Design"),
  H2("A. Learning cycle"),
  body("Each activity follows the cycle of Fig. 2. Students first *predict* with the equations, committing to a value as in POE [13]; they *observe* readings arriving through the interface (concrete experience); they *explain* the error map in physical terms (reflection and conceptualisation); and they *calibrate* and test the corrected model on unseen points (active experimentation) [14], which leads to a new prediction."),
];
const fig2 = [img("figures/fig_learning_cycle.png", 2.7), caption("Fig. 2.  Learning cycle of the digital-shadow environment.")];
const sIVb = [
  H2("B. Laboratory sequence"),
  body("Table III lists seven laboratories that progress from an ideal world to realistic conditions. Each corresponds to a scenario whose outcome was verified in Section V, so the instructor knows what students should find."),
  ...tcap("III", "Laboratory sequence, course topics and cognitive level"),
  tableL([380, 1500, 1840, 1320], [
    ["Lab", "Scenario", "Course topic", "Cognitive level [21]"],
    ["1", "Ideal sensor, ideal world", "Free-space loss, link budget", "Remember, apply"],
    ["2", "Hidden physical effects", "System, building and indoor losses; path-loss exponent", "Apply, analyse"],
    ["3", "Realistic sensor", "Log-normal shadowing as an accuracy floor", "Analyse"],
    ["4", "Fading averaging on/off", "Rayleigh fading, local-mean averaging", "Analyse"],
    ["5", "GPS, drift, display, losses", "Measurement practice and sensor quality", "Analyse, evaluate"],
    ["6", "Reality follows another model", "Model selection and limits; two-ray interference", "Evaluate"],
    ["7", "Verification against ITU-R", "Standards and software verification", "Evaluate"],
  ]),
  sp(),
  H2("C. Intended learning outcomes"),
  body("After the sequence, students should be able to: (LO1) compute a link budget and field strength with ITU-R methods; (LO2) explain why measurements depart from predictions and attribute the departure to physical causes; (LO3) distinguish systematic errors, which calibration removes, from random shadowing, which it cannot; (LO4) judge the quality of a measurement procedure; and (LO5) validate a model on data it was not fitted to.", { noIndent: true }),
  H2("D. The instructor's \"mystery channel\""),
  body("Because the simulator sends readings through the same interface as a sensor, the instructor can create a hidden reality, for example an unknown cable loss and building loss, and stream it to a class channel. Students work out the hidden values from the readings; the simulator's log is the answer key, which makes the activity directly assessable. Changing the hidden values gives each group or each year a new problem."),
  H2("E. Interaction features"),
  body("Students work on a real map with transmitters and receivers, a terrain profile with the Fresnel zone, and an animation of ground, sky and line-of-sight propagation in an *Engineering* or a *Teaching* display style. A link budget, a verification panel and virtual-laboratory experiments in Aim–Theory–Procedure–Simulation–Observation format complete the environment, and all views share one station model, so a change in one view appears in all. Fig. 3 shows two of the views students work with."),
];
const fig3s = [img("figures/fig_student_views.png", 7.0), caption("Fig. 3.  Student views: (a) animation of a 312.1 MHz studio-to-transmitter link with the live link budget, Engineering style (illustrative terrain profile); (b) digital-shadow map of 80 simulated readings around the 433 MHz campus station after calibration, coloured by the remaining error (map background omitted in the controlled run).")];

const sV = [
  H1("V. Validation of the Learning Environment"),
  body("A learning environment must teach correct physics, and its data path must not distort what students see. Both were tested before classroom use."),
  H2("A. Verification of the equation engine"),
  body("The P.1812 implementation was run on the 19 profiles of the ITU-R P.1812-6 validation set (95–500 MHz, 1–235 km, both polarisations, rural to dense-urban clutter) and compared with the reference implementation approved by ITU-R Working Party 3K [22]. The basic transmission loss agreed within 0.003 dB on every profile (RMS 0.001 dB)."),
  H2("B. Validation of the data path with a sensor simulator"),
  body("An external MATLAB/Octave simulator acted as the sensor network for a 433 MHz campus station (18 m mast, 2 W ERP, 160 points within 450 m), sending 2,381 readings through the API in five scenarios: S0, an ideal sensor in the conditions of the equations; S1, an ideal sensor with hidden offset, building, indoor and distance terms (−4.0 dB, −8.6 dB, −3.5 dB, −3.2 dB/decade); S2, a realistic sensor (4 dB correlated shadowing, Rayleigh fading averaged over 40 samples, 3 m GPS error, calibration error, drift and a 1 dB display step); and S3–S4, realistic sensors in a world that follows independent models, the close-in model [23] and an exact two-ray model. The runs used flat ground and no building geometry to isolate interface and sensor effects."),
  body(`All readings arrived unchanged (largest difference below 0.001 dB). In S0 they reproduced the equation-only prediction within ${f(S.S0[8], 3)} dB, confirming that ideal sensors in ideal conditions give the equation result. In S1 calibration recovered every hidden term exactly. Fig. 4 and Table IV show the realistic cases: the test error fell from ${f(S.S2[9], 1)} to ${f(S.S2[11], 1)} dB in S2, close to the 4 dB shadowing floor, and from ${f(S.S3[9], 1)} to ${f(S.S3[11], 1)} dB and ${f(S.S4[9], 1)} to ${f(S.S4[11], 1)} dB when the world followed another model.`),
];
const fig3 = [img("figures/fig_rms_by_scenario.png", 3.2), caption("Fig. 4.  RMS error on unseen test points for the equation-only prediction and the calibrated digital shadow (mean ± standard deviation over runs).")];
const sVb = [
  ...tcap("IV", "Test RMS error (dB) and what students observe"),
  tableL([380, 760, 860, 3040], [
    ["", "Equation only", "Calibrated", "Observation for students (lab)"],
    ["S0", f(S.S0[9], 3), f(S.S0[11], 3), "Ideal world: theory and measurement agree (1)"],
    ["S1", f(S.S1[9], 1), f(S.S1[11], 3), "Hidden physical effects are found exactly (2)"],
    ["S2", f(S.S2[9], 1), f(S.S2[11], 1) + " ± " + f(S.S2[12], 1), "Shadowing sets a floor that no correction removes (3)"],
    ["S3", f(S.S3[9], 1), f(S.S3[11], 1) + " ± " + f(S.S3[12], 1), "A wrong model is corrected where data exist (6)"],
    ["S4", f(S.S4[9], 1), f(S.S4[11], 1) + " ± " + f(S.S4[12], 1), "Interference is not linear: choose a better model (6)"],
  ]),
  sp(),
  H2("C. Sensitivity to sensor imperfections"),
  body(`A one-factor-at-a-time analysis (84 runs, 6,501 readings) supports Labs 4 and 5. The calibrated error followed the shadowing level (${SEN.filter(r => r.fac === "shadow_db").map(r => f(r.cal, 1)).join(", ")} dB for σ = 2, 4, 6 dB) and changed by less than 1 dB for GPS errors up to 25 m, drift up to 5 dB/h, a 3 dB display step or half of the readings lost; a single unaveraged fading sample, however, raised it to ${f(SEN.find(r => r.fac === "fade_k" && r.v === 1).cal, 1)} dB, illustrating the local-mean averaging rule [24] (Fig. 5).`),
];
const fig5 = [img("figures/fig_sensitivity.png", 3.2), caption("Fig. 5.  Test RMS error after calibration versus each sensor imperfection (mean ± standard deviation over four runs; K = 0: no fading).")];

const sVI = [
  H1("VI. Discussion"),
  H2("A. Why a digital shadow matters for wireless education"),
  body("Equation-only tools show students what the theory predicts; a digital shadow also shows where and why reality departs from it, which is the step that turns knowledge of formulas into engineering judgement. Five features make the concept valuable for teaching. First, the theory–measurement gap becomes visible and quantitative, so students reason about evidence rather than accept a single curve. Second, calibration separates systematic errors, which have physical causes, from random shadowing, which sets an accuracy floor; this distinction is central to the statistical channel models taught in wireless courses and is hard to convey with equations alone. Third, the predict–measure–calibrate loop mirrors professional practice, where models are tuned with drive-test data, so students practise a workplace skill. Fourth, the hold-out test introduces data-literacy ideas such as overfitting and validation that connect wireless engineering with computing. Fifth, the loop can be taught without radio hardware, which matters for institutions that cannot equip a full RF laboratory and supports a more equitable and sustainable engineering education."),
  H2("B. Simulated data as a teaching asset"),
  body("Using a simulator is a deliberate choice at this stage, not only a substitute for hardware. A simulator provides a known ground truth, so student answers can be assessed, effects can be switched on one at a time, and difficulty can be raised gradually from Lab 1 to Lab 6. Because the simulator uses the same interface as a physical sensor, smartphones and software-defined radios can be added later without changing the environment, moving students from a controlled world to authentic data."),
  H2("C. Integration into a course"),
  body("The sequence fits two to three practical sessions of a wireless or communication-systems course: Labs 1–3 after the propagation lectures, Labs 4–5 with fading and measurement, and Labs 6–7 as an evaluative assignment. A mystery-channel task can serve as assessed coursework."),
  H2("D. Limitations and planned evaluation"),
  body("The present work establishes the design and the technical trustworthiness of the environment; it does not yet measure learning gains. The validation used simulated sensors, one frequency, flat terrain and no building geometry. A classroom study is planned with a pre- and post-test of propagation concepts, the System Usability Scale [25] and students' written explanations of the theory–measurement gap, followed by sessions with smartphone and software-defined-radio sensors."),
];
const sVII = [
  H1("VII. Conclusion"),
  body("This paper applied the digital shadow concept to wireless communication education through an open, browser-based learning environment in which students predict with ITU-R methods, observe readings fed through a measurement interface, explain the difference and calibrate the model. Six data-integration methods, from digital sensor readings through an API to live environmental data, connect the environment to simulated and, later, physical sensors. The environment agrees with the ITU-R P.1812-6 reference implementation within 0.003 dB, and a sensor simulator showed that the data path is lossless and that the learning outcomes intended for each laboratory are reproducible. The environment makes the gap between theory and measurement, the core of engineering judgement in radio, accessible to every student without radio hardware."),
  H1("Acknowledgment"),
  body("[Acknowledge the supervisor, institutions and data providers.] The authors used AI tools to assist in developing parts of the software and in drafting this manuscript; the authors verified all models, results and references and take full responsibility for the content.", { noIndent: true }),
];

const refs = [
  "T. S. Rappaport, *Wireless Communications: Principles and Practice*, 2nd ed. Upper Saddle River, NJ, USA: Prentice Hall, 2002.",
  "J. D. Parsons, *The Mobile Radio Propagation Channel*, 2nd ed. Chichester, U.K.: Wiley, 2000.",
  "W. Kritzinger, M. Karner, G. Traar, J. Henjes, and W. Sihn, “Digital twin in manufacturing: A categorical literature review and classification,” *IFAC-PapersOnLine*, vol. 51, no. 11, pp. 1016–1022, 2018.",
  "M. Gudmundson, “Correlation model for shadow fading in mobile radio systems,” *Electron. Lett.*, vol. 27, no. 23, pp. 2145–2146, Nov. 1991.",
  "*Ground-wave propagation prediction method for frequencies between 10 kHz and 30 MHz*, Rec. ITU-R P.368, ITU, Geneva.",
  "*A path-specific propagation prediction method for point-to-area terrestrial services in the frequency range 30 MHz to 6 000 MHz*, Rec. ITU-R P.1812-6, ITU, Geneva, 2021.",
  "*Propagation by diffraction*, Rec. ITU-R P.526, ITU, Geneva.",
  "*Calculation of free-space attenuation*, Rec. ITU-R P.525, ITU, Geneva.",
  "*Propagation data and prediction methods required for the design of terrestrial line-of-sight systems*, Rec. ITU-R P.530-18, ITU, Geneva, 2021.",
  "T. de Jong, M. C. Linn, and Z. C. Zacharia, “Physical and virtual laboratories in science and engineering education,” *Science*, vol. 340, no. 6130, pp. 305–308, 2013.",
  "Virtual Labs, Ministry of Education, Government of India. [Online]. Available: https://www.vlab.co.in [accessed date]",
  "S. Freeman *et al.*, “Active learning increases student performance in science, engineering, and mathematics,” *Proc. Natl. Acad. Sci. USA*, vol. 111, no. 23, pp. 8410–8415, 2014.",
  "R. White and R. Gunstone, *Probing Understanding*. London, U.K.: Falmer Press, 1992.",
  "D. A. Kolb, *Experiential Learning: Experience as the Source of Learning and Development*. Englewood Cliffs, NJ, USA: Prentice Hall, 1984.",
  "M. Grieves and J. Vickers, “Digital twin: Mitigating unpredictable, undesirable emergent behavior in complex systems,” in *Transdisciplinary Perspectives on Complex Systems*. Cham, Switzerland: Springer, 2017, pp. 85–113.",
  "P. Almasan *et al.*, “Network digital twin: Context, enabling technologies, and opportunities,” *IEEE Commun. Mag.*, vol. 60, no. 11, pp. 22–27, Nov. 2022.",
  "R. Coudé, “Radio Mobile,” software. [Online]. Available: [URL, accessed date]",
  "J. A. Magliacane, “SPLAT! RF signal propagation, loss, and terrain analysis tool,” software. [Online]. Available: [URL, accessed date]",
  "*The radio refractive index: its formula and refractivity data*, Rec. ITU-R P.453, ITU, Geneva.",
  "*Evolved Universal Terrestrial Radio Access (E-UTRA); Physical layer; Measurements*, 3GPP TS 36.214.",
  "L. W. Anderson and D. R. Krathwohl, Eds., *A Taxonomy for Learning, Teaching, and Assessing: A Revision of Bloom's Taxonomy of Educational Objectives*. New York, NY, USA: Longman, 2001.",
  "I. Stevanovic, “MATLAB/Octave implementation of Recommendation ITU-R P.1812-6,” software, v6.0, Zenodo, doi: 10.5281/zenodo.6141558.",
  "T. S. Rappaport, G. R. MacCartney, M. K. Samimi, and S. Sun, “Wideband millimeter-wave propagation measurements and channel models for future wireless communication system design,” *IEEE Trans. Commun.*, vol. 63, no. 9, pp. 3029–3056, Sep. 2015.",
  "W. C. Y. Lee, “Estimate of local average power of a mobile radio signal,” *IEEE Trans. Veh. Technol.*, vol. 34, no. 1, pp. 22–27, Feb. 1985.",
  "J. Brooke, “SUS: A ‘quick and dirty’ usability scale,” in *Usability Evaluation in Industry*, P. W. Jordan *et al.*, Eds. London, U.K.: Taylor & Francis, 1996, pp. 189–194.",
];
const refBlock = [H1("References"), ...refs.map((r, i) => new Paragraph({ children: [new TextRun({ text: `[${i + 1}]\t`, font: FONT, size: pt(8) }), ...runs(r, { size: pt(8) })],
  tabStops: [{ type: TabStopType.LEFT, position: 360 }], indent: { left: 360, hanging: 360 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 30 } }))];

const page = { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1440, left: 900, right: 900 } };
const twoCol = { column: { count: 2, space: 360, equalWidth: true } };
const doc = new Document({
  creator: "[Authors]", title: TITLE,
  styles: { default: { document: { run: { font: FONT, size: pt(10) } } } },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: D.LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 288, hanging: 202 } } } }] }] },
  sections: [
    { properties: { page }, children: title },
    { properties: { page, type: SectionType.CONTINUOUS, ...twoCol }, children: [abs, kw, ...sI, ...sII, ...sIII] },
    { properties: { page, type: SectionType.CONTINUOUS }, children: fig1 },
    { properties: { page, type: SectionType.CONTINUOUS, ...twoCol }, children: [...sIIIb, ...sIV, ...fig2, ...sIVb] },
    { properties: { page, type: SectionType.CONTINUOUS }, children: fig3s },
    { properties: { page, type: SectionType.CONTINUOUS, ...twoCol }, children: [...sV, ...fig3, ...sVb, ...fig5, ...sVI, ...sVII, ...refBlock] },
  ],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUTFILE, b); console.log("written", OUTFILE); });
