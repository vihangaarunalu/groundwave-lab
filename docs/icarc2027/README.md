# ICARC 2027 paper: manuscript draft and validation experiment

- `ICARC2027_manuscript_clean.docx` (no comments) and `ICARC2027_manuscript_with_comments.docx` (Word comments listing what the authors must confirm): the manuscript in IEEE conference layout (US Letter, two columns).
- `ICARC2027_manuscript_draft_preview.pdf`: a PDF rendering of the same file, for reading.
- `build_manuscript.js`: regenerates the .docx from the data (`node build_manuscript.js`). This writes ICARC2027_manuscript_draft.docx without comments.
- `figures/`: Fig. 1–4 (300 dpi).
- `data/`: everything behind the numbers in Section V.

## What the experiment shows

An external MATLAB/Octave simulator plays the sensor network and sends readings through the platform's measurement interface (`POST /api/measure`). The platform receives them on the Digital shadow → Live link, compares them with its equation-only ITU-R prediction, calibrates on about 70 % of the points and tests on the rest.

| Scenario | Simulated reality | Sensor | Result |
|---|---|---|---|
| S0 | exactly the equations | ideal | readings = equations within 0.013 dB |
| S1 | equations + hidden offset, building, indoor, trend | ideal | hidden terms recovered exactly; test RMS 0.004 dB |
| S2 | as S1 | realistic | test RMS 7.65 → 4.19 ± 0.43 dB (shadowing floor 4 dB) |
| S3 | 3GPP close-in model, n = 3 | realistic | 33.6 → 4.5 dB |
| S4 | exact two-ray model | realistic | 12.5 → 5.5 dB |

## Reproduce

1. Open the Shadow tab (live site, or locally with `node pages.mjs`), place the station and press **Export points for MATLAB** to get `wisdom-plan.csv`.
2. In MATLAB or Octave, in the folder holding `wisdom-plan.csv`, run `icarc_validation` (`assets/icarc_validation.m`). Set `URL` at the top to your deployment. The script posts every run to its own channel (`icarc-s0-r01`, …) and writes `icarc-sent.csv`.
3. For each channel, on the Shadow tab:
   - tick **Replace sample points with real data**, enter the channel and press **Connect**;
   - tick the hold-out box, then press **Calibrate the model**;
   - press **Export CSV** and save the file as `pts-<channel>.csv`;
   - press **Save this result**.
   At the end, press **Export results** and save the file as `icarc-page-results.csv`.
4. Run `python3 assets/icarc_analysis.py <folder>` to get `icarc-summary.csv`, `icarc-coefficients.csv` and the figures.

The reported runs used a controlled setting: flat ground at 10 m and no building geometry. Building and indoor effects enter through the flags in the plan. This isolates the interface and the sensor effects. On the live site the ground comes from the Copernicus DEM, so the absolute levels differ, but the method is the same.

## Sensitivity analysis (Table V, Fig. 5)

Starting from the realistic sensor of S2, one imperfection is made worse at a time, with 4 runs per level (84 runs, 6,501 readings):

| Imperfection | Levels | Test RMS after calibration (dB) |
|---|---|---|
| GPS error (m) | 0 / 3 / 10 / 25 | 4.6 / 4.2 / 4.3 / 4.8 |
| Receiver drift (dB/h) | 0 / 0.5 / 2 / 5 | 4.1 / 4.2 / 3.9 / 4.8 |
| Fading samples averaged K | none / 1 / 10 / 40 | 4.6 / 7.5 / 4.7 / 4.6 |
| Display step (dB) | 0 / 1 / 3 | 4.0 / 4.6 / 4.1 |
| Readings lost (%) | 0 / 20 / 50 | 4.1 / 4.8 / 4.1 |
| Shadowing σ (dB) | 2 / 4 / 6 | 2.1 / 4.1 / 6.2 |

Reproduce:
1. In MATLAB or Octave, run `icarc_validation('sensitivity')`. This writes `icarc-sens-sent.csv` and posts to channels `icarc-e-…`.
2. Process each channel on the Shadow tab as above. Save the results as `icarc-sens-page-results.csv`.
3. Run `python3 assets/icarc_sensitivity.py <folder>`.

## Education-track manuscript (submission version)

Title: *Applying the Digital Shadow Concept to Wireless Communication Education: A Browser-Based, ITU-R-Verified Learning Environment*

- `ICARC2027_education_manuscript.docx`: clean copy, 6 pages, IEEE two-column.
- `ICARC2027_education_manuscript_with_comments.docx`: the same text, with notes for the authors.
- `ICARC2027_education_manuscript_preview.pdf`: preview.
- `build_manuscript_edu.js`: rebuilds the clean copy from the data (`node build_manuscript_edu.js`).

Sections:
- Introduction
- Existing work
- The learning environment, with six data-integration methods: API, simulator, physical sensors, smartphone, files, environmental data
- Interactive learning design: learning cycle, seven laboratories, learning outcomes, instructor's "mystery channel"
- Validation of the learning environment
- Discussion: why a digital shadow matters for wireless education, simulated data as a teaching asset, course integration, limitations and planned evaluation
- Conclusion

The earlier technical manuscript (`ICARC2027_manuscript_*.docx`) is kept for reference.
