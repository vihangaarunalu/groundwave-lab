# Paper notes: Groundwave Propagation Lab and the WISDOM digital shadow

Material for writing a conference paper about the website (v9.4). Check every number against
your own runs before you use it; the values below are from the authors' test runs.

## 1. What the system is (one paragraph)

An open, browser-based laboratory for radio-wave propagation that combines (i) ITU-R prediction
models from LF to UHF, (ii) a digital shadow that compares predictions with measurements on a real
map, using OpenStreetMap buildings, and calibrates the model by least squares, (iii) a
standards-guided planner for sensors and walk tests, (iv) an open measurement interface through which
MATLAB, Octave, Python or SDR sensors stream readings, and (v) five virtual-lab experiments in the
Aim-Theory-Procedure-Simulation-Observation-Test format. Nothing has to be installed.

## 2. Models and standards used

| Part | Model / method | Source |
|---|---|---|
| Ground wave (LF/MF) | GRWAVE method, Millington mixed paths | ITU-R P.368, ITU Handbook on Ground Wave Propagation (2014) |
| MF sky wave | Sky-wave field strength | ITU-R P.1147 |
| HF sky wave, skip distance | Secant law, curved-earth geometry | ITU-R P.533, P.1239 |
| VHF/UHF point-to-area | Delta-Bullington diffraction, troposcatter | ITU-R P.1812 |
| Clutter and building entry | Clutter loss; building entry loss | ITU-R P.2108; ITU-R P.2109 |
| Obstacles (buildings, hills) | Single knife edge J(ν); two strongest edges | ITU-R P.526 |
| Ground reflection | Two-ray model with Fresnel coefficients | ITU-R P.527 ground constants; Rappaport (2002) |
| Rain | Specific attenuation | ITU-R P.838 |
| Free space (line of sight) | Free-space attenuation; field strength from received power | ITU-R P.525 |
| Atmospheric refraction | Refractivity gradient (−40 N/km standard; ducting below −157 N/km), effective earth radius k·R | ITU-R P.453, ITU-R P.834 |
| Line-of-sight path clearance | Fresnel-zone clearance criteria | ITU-R P.530, ITU-R P.526 |
| Fading statistics | Rayleigh / Nakagami-Rice distributions | ITU-R P.1057, ITU-R P.1406 |
| EARFCN → frequency | 4G operating bands | 3GPP TS 36.101 |
| Mobile fading (experiment) | Clarke/Jakes sum of sinusoids; Rice statistics | Clarke (1968); Jakes (1974) |
| Walk-test planning | Route measurements; 40λ averaging; coverage edge | ITU-R SM.1708; Lee (1985); BS.412 / BT.1368 |
| Shadowing (sensor model) | Exponentially correlated log-normal shadowing | Gudmundson (1991) |
| Calibration | Least squares on offset, building, indoor and distance trend, with hold-out test | – |

## 3. Software-in-the-loop sensor model (MATLAB / Octave)

`assets/wisdom_experiments.m` adds hidden "reality" terms (offset, building loss, indoor loss,
distance trend) and sensor effects: correlated shadowing (σ, decorrelation distance), Rayleigh
fading averaged over K samples, GPS error, receiver calibration error and drift, 1 dB display
resolution, sensitivity limit and lost readings. Independent reality models: 3GPP close-in (n = 3)
and an exact two-ray model.

**Verification of the chain.** With every sensor effect switched off, the page recovered the hidden
values exactly (offset −2.5 dB, building −8.6 dB, indoor −3.5 dB, trend −3.2 dB/decade; test error
0.0 dB). This shows the export → MATLAB → calibration → comparison chain is correct.

Experiments E1-E4 (run them and report your own numbers):
- E1: recovery of the hidden errors (mean ± std over repeats)
- E2: test error against the number of training readings for several shadowing levels
- E3: test error before and after calibration when reality follows another model
- E4: sensitivity to GPS error, receiver drift, fading averaging, lost readings and display rounding

Observation from the campus scenario: the offset and the distance trend are strongly correlated when
all points lie within a few hundred metres (about one decade of distance). The prediction
error stays low, but the two terms are individually uncertain. A few far points separate them.

## 4. Virtual-lab experiments (Experiments tab)

| # | Experiment | Checked against |
|---|---|---|
| 1 | Skip distance of the HF sky wave | Flat-earth formula 2h√((f/fc)²−1) (agrees at short range; curved earth longer at long range) |
| 2 | Two-ray ground reflection | Free space; breakpoint 4hₜhᵣ/λ; −40 dB/decade beyond it |
| 3 | Knife-edge diffraction | J(ν) of ITU-R P.526 (6 dB at ν = 0) |
| 4 | Fading channels | Rice CDF, level crossing rate and average fade duration (e.g. Rayleigh, 900 MHz, 50 km/h, −10 dB: 9.3 % vs 9.5 % below threshold; 30.5 vs 29.9 crossings/s) |
| 5 | Digital shadow calibration | Hidden values recovered; test error levels off at the shadowing σ |
| 6 | Real 4G measurement with a smartphone | RSRP → field strength conversion; calibration with real readings |

Each experiment exports its observation table as CSV and prints as a lab sheet.

## 5. Real measurements with a smartphone

Sensor: an Android phone with a logging app (report app name and version, phone model, Android version,
logging interval, operator, band, EARFCN). Conversion used by the importer:

    P_total = RSRP + 10·log10(12·N_RB)            (N_RB = 25/50/75/100 for 5/10/15/20 MHz)
    E [dBµV/m] = P_total [dBm] + 20·log10(f MHz) + 77.2 − G [dBi]

Readings from the serving cell only, averaged in linear power every 40 λ (Lee 1985; ITU-R SM.1708).
The tower ERP is estimated from the median reading (unknown for operator sites); calibration then reports
the remaining terms. Measure the same route twice, ideally with two phones, and report the difference as
measurement uncertainty. RSRP absolute accuracy of phones is limited (3GPP TS 36.133, about ±6 dB).

## 6. Verification of the implementation (Models tab → Verification)

**External reference.** The site's ITU-R P.1812 code was run on the 19 terrain profiles of the ITU-R P.1812-6
validation set. The site's values were compared with the results of the reference implementation approved by
ITU-R Working Party 3K (Stevanovic, doi:10.5281/zenodo.6141558) at p = 50 % time and 50 % locations.

| Quantity | Largest difference over 19 profiles |
|---|---|
| Free-space loss Lbfs (Eq. 8) | 0.000 dB |
| Bullington losses Lbulla, Lbulls | 0.000 dB |
| Spherical-earth diffraction Ldsph | 0.005 dB |
| Median diffraction loss Ld50 | 0.005 dB |
| Troposcatter loss Lbs (Eq. 44) | 0.000 dB |
| Path angular distance θ | 0.000 mrad |
| **Basic transmission loss Lb** | **0.003 dB** (mean −0.000 dB, RMS 0.001 dB, n = 19) |

The profiles cover 95–500 MHz, 1–235 km, horizontal and vertical polarization, rural, urban and dense-urban clutter,
and line-of-sight and trans-horizon paths. Re-run it in the browser; **Download CSV** gives the full table.

While building this check, two differences from P.1812-6 were found and corrected (v10.7):
1. The troposcatter loss had a gas-absorption and coupling term that Eq. (44) of P.1812-6 does not have. At 96 km this added about 0.5 dB.
2. The horizon angles used terrain plus clutter. P.1812 §3.2 uses bare terrain for them, and terrain plus clutter only for diffraction.

**Closed-form checks** (14 of 14 pass):
- Free-space loss against 20·log(4πd/λ): −0.05 dB, the rounding of the 92.4 constant.
- The P.526 J(ν) approximation against the exact Fresnel-integral knife-edge loss: within 0.11 dB for ν from 0 to 3.
- The P.1812 Attachment 2 inverse-normal approximation: within its stated 0.00054.
- The effective earth radius for k = 4/3.

Suggested wording: "The implementation of ITU-R P.1812-6 was verified against the ITU-R Working Party 3K reference
implementation on its 19 validation profiles; the basic transmission loss agreed within 0.003 dB in every case."

**Measurement statistics** (Digital shadow): the tile gives n, mean error (bias), standard deviation, RMS,
largest error and the correlation r, with e = measured − predicted. Report them for the training points and, separately, the test points.

**Location variability** (Map): coverage at 50, 90, 95 and 99 % of locations from σL (ITU-R P.1812). Example:
Colombo → Yatiyantota, 312.1 MHz, σL = 3.7 dB, fade margin +36.4 dB at 50 % and +30.2 dB at 95 % of locations.

## 6b. Link availability of the STL (Terrain profile tab → Link availability)

Method: ITU-R P.530-18 §2.3.
- §2.3.1, Eq. (7): multipath fading in the average worst month.
- §2.3.2: all fade depths.
- §2.3.4: conversion to the average year, with ΔG ≤ 10.8 dB.

Inputs:
- Path length, frequency, and antenna heights above sea level, all from the terrain profile.
- Mean terrain height.
- Flat fade margin from the link budget (receiver judged as a link).
- Geoclimatic factor log K and dN75, read at the path midpoint from the ITU-R P.530-18 digital maps
  **LogK.csv** and **dN75.csv**. Download them from itu.int and choose them in the card; the ITU does not
  allow the maps to be redistributed, so the site does not include them.

Validity: d ≥ 5 km and f ≥ 15/d GHz (251 MHz for the 60 km Colombo → Yatiyantota path, so 312.1 MHz is inside).
Rain attenuation is not included: ITU-R P.838 starts at 1 GHz, and rain is negligible at VHF/UHF.

The computation was checked against an independent calculation from the equations.
An open MATLAB implementation exists (github.com/eeveetza/p530, marked untested by its author). It applies
`max` where P.530 Eq. (31) caps ΔG at 10.8 dB, so do not use it for the annual figure without correcting this.

Report: worst-month and annual percentage of time below sensitivity, availability % and outage minutes per year.
**Use the real map values for the paper; the example numbers produced while testing the code came from synthetic maps.**

Receiver panel helpers:
- Cable loss from a cable class and length (typical data-sheet attenuation at 100 MHz, scaled with √f, plus 0.2 dB for connectors).
- Sensitivity = −174 dBm/Hz + 10·log B + NF + C/N (T₀ = 290 K).

## 7. Honest limitations (put these in the paper)

- Results in this phase come from simulated sensors (software-in-the-loop); SDR measurements are
  planned under the grant.
- P.1812 is implemented for p = 50 % time only (no ducting or anomalous propagation at small time percentages).
- P.1812 uses a straight-line ground profile from the end-point heights when the elevation service
  is unavailable.
- The ground-wave model (P.368) has not yet been compared with GRWAVE reference output.
- Buildings: OpenStreetMap footprints, heights from tags or floors × 3.2 m (editable); two strongest
  knife edges, not a full multiple-edge or ray-tracing method.
- Antenna patterns are horizontal only (no vertical pattern or tilt).
- Commodity receivers (RTL-SDR, phones) need calibration against a known source.
- AI-assisted development: disclose it according to the conference policy, and state that the authors
  verified the models and results.

## 8. BibTeX

```bibtex
@misc{itu_p1812, author={{ITU-R}}, title={Recommendation {ITU-R} {P}.1812: A path-specific propagation prediction method for point-to-area terrestrial services in the frequency range 30 {MHz} to 6000 {MHz}}, institution={International Telecommunication Union}, address={Geneva}}
@software{stevanovic_p1812, author={Stevanovic, Ivica}, title={{MATLAB/Octave} Implementation of Recommendation {ITU-R} {P}.1812-6}, version={6.0}, doi={10.5281/zenodo.6141558}, url={https://github.com/eeveetza/p1812}}
@misc{itu_p526, author={{ITU-R}}, title={Recommendation {ITU-R} {P}.526: Propagation by diffraction}, institution={International Telecommunication Union}, address={Geneva}}
@misc{itu_p2109, author={{ITU-R}}, title={Recommendation {ITU-R} {P}.2109: Prediction of building entry loss}, institution={International Telecommunication Union}, address={Geneva}}
@misc{itu_p533, author={{ITU-R}}, title={Recommendation {ITU-R} {P}.533: Method for the prediction of the performance of {HF} circuits}, institution={International Telecommunication Union}, address={Geneva}}
@misc{itu_p368, author={{ITU-R}}, title={Recommendation {ITU-R} {P}.368: Ground-wave propagation prediction method for frequencies between 10 {kHz} and 30 {MHz}}, institution={International Telecommunication Union}, address={Geneva}}
@misc{itu_sm1708, author={{ITU-R}}, title={Recommendation {ITU-R} {SM}.1708: Field-strength measurements along a route with geographical coordinate registrations}, institution={International Telecommunication Union}, address={Geneva}}
@article{clarke1968, author={Clarke, R. H.}, title={A statistical theory of mobile-radio reception}, journal={Bell System Technical Journal}, volume={47}, number={6}, pages={957--1000}, year={1968}}
@book{jakes1974, editor={Jakes, W. C.}, title={Microwave Mobile Communications}, publisher={Wiley}, year={1974}}
@article{lee1985, author={Lee, W. C. Y.}, title={Estimate of local average power of a mobile radio signal}, journal={IEEE Transactions on Vehicular Technology}, volume={34}, number={1}, pages={22--27}, year={1985}}
@article{gudmundson1991, author={Gudmundson, M.}, title={Correlation model for shadow fading in mobile radio systems}, journal={Electronics Letters}, volume={27}, number={23}, pages={2145--2146}, year={1991}}
@book{rappaport2002, author={Rappaport, T. S.}, title={Wireless Communications: Principles and Practice}, edition={2}, publisher={Prentice Hall}, year={2002}}
@book{parsons2000, author={Parsons, J. D.}, title={The Mobile Radio Propagation Channel}, edition={2}, publisher={Wiley}, year={2000}}
@misc{3gpp36214, author={{3GPP}}, title={{TS} 36.214: Evolved Universal Terrestrial Radio Access ({E-UTRA}); Physical layer; Measurements}, institution={3rd Generation Partnership Project}}
@misc{3gpp36133, author={{3GPP}}, title={{TS} 36.133: Evolved Universal Terrestrial Radio Access ({E-UTRA}); Requirements for support of radio resource management}, institution={3rd Generation Partnership Project}}
@book{goldsmith2005, author={Goldsmith, A.}, title={Wireless Communications}, publisher={Cambridge University Press}, year={2005}}
```

Add the edition year of each ITU-R Recommendation you actually used (for example P.1812-7, 2023).
