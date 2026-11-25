"""Sensitivity analysis of the ICARC validation: one sensor problem made worse at a time.

Inputs (one folder): icarc-sens-sent.csv (from icarc_validation('sensitivity')), pts-<channel>.csv
exported by the page for every channel, icarc-sens-page-results.csv (page: Export results).
Outputs: icarc-sensitivity.csv and fig_sensitivity.png.   Usage: python3 icarc_sensitivity.py <folder>
"""
import csv, math, os, statistics as st, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

D = sys.argv[1] if len(sys.argv) > 1 else "."
rd = lambda p: list(csv.DictReader(open(p, newline="")))
rms = lambda v: math.sqrt(sum(x * x for x in v) / len(v)) if v else float("nan")

sent = rd(os.path.join(D, "icarc-sens-sent.csv"))
runs = {}
for r in sent:
    runs.setdefault(r["channel"], {"factor": r["factor"], "value": float(r["value"]), "n": 0})["n"] += 1
res = rd(os.path.join(D, "icarc-sens-page-results.csv"))
TMID = (80 - 1) / 2 / 60          # mean time of the 80 readings in hours (drift accumulates over the walk)

rows = []
for (ch, info), pr in zip(sorted(runs.items()), res):
    pts = [p for p in rd(os.path.join(D, f"pts-{ch}.csv")) if p["source"] == "live"]
    test = [p for p in pts if p["test_point"] == "1"]
    e_eq = [float(p["measured_dBuV_m"]) - float(p["equation_only_dBuV_m"]) for p in test]
    e_cal = [float(p["measured_dBuV_m"]) - float(p["calibrated_dBuV_m"]) for p in test]
    drift = info["value"] if info["factor"] == "drift_db_h" else 0.5
    off_true = -4.0 + 1.5 + drift * TMID
    rows.append({"factor": info["factor"], "value": info["value"], "received": len(pts),
                 "eq_rms_test": rms(e_eq), "cal_rms_test": rms(e_cal),
                 "offset_err": abs(float(pr["offset_dB"]) - off_true)})

LABEL = {"gps_m": "GPS error (m)", "drift_db_h": "Drift (dB/h)", "fade_k": "Fading samples K",
         "quant_db": "Display step (dB)", "loss_pct": "Lost readings (%)", "shadow_db": "Shadowing σ (dB)"}
summary = []
for fac in LABEL:
    for v in sorted({r["value"] for r in rows if r["factor"] == fac}):
        R = [r for r in rows if r["factor"] == fac and r["value"] == v]
        c = [r["cal_rms_test"] for r in R]
        summary.append({"factor": fac, "value": v, "runs": len(R), "received_mean": st.mean(r["received"] for r in R),
                        "eq_rms_test": st.mean(r["eq_rms_test"] for r in R), "cal_rms_test": st.mean(c),
                        "cal_rms_test_sd": st.stdev(c) if len(c) > 1 else 0.0, "offset_err": st.mean(r["offset_err"] for r in R)})
with open(os.path.join(D, "icarc-sensitivity.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(summary[0].keys())); w.writeheader()
    for r in summary: w.writerow({k: (f"{v:.3f}" if isinstance(v, float) else v) for k, v in r.items()})

plt.rcParams.update({"font.family": "DejaVu Serif", "font.size": 7, "axes.linewidth": 0.6, "figure.dpi": 300})
fig, axs = plt.subplots(2, 3, figsize=(3.5, 2.6), sharey=True)
for ax, fac in zip(axs.flat, LABEL):
    S = [r for r in summary if r["factor"] == fac]
    x = list(range(len(S)))
    ax.errorbar(x, [r["cal_rms_test"] for r in S], yerr=[r["cal_rms_test_sd"] for r in S], color="black", marker="o", ms=2.5, lw=0.8, capsize=2, elinewidth=0.6)
    ax.set_xticks(x); ax.set_xticklabels([f"{r['value']:g}" for r in S], fontsize=6)
    ax.set_title(LABEL[fac], fontsize=6.2); ax.set_ylim(0, 10); ax.grid(axis="y", color="0.85", lw=0.4)
    ax.spines[["top", "right"]].set_visible(False)
for ax in axs[:, 0]: ax.set_ylabel("Test RMS (dB)", fontsize=6.5)
fig.tight_layout(pad=0.3, h_pad=0.6, w_pad=0.4)
fig.savefig(os.path.join(D, "fig_sensitivity.png"))
for r in summary:
    print(f"{r['factor']:<11} {r['value']:>5g}  n={r['received_mean']:.0f}  eq={r['eq_rms_test']:.2f}  cal={r['cal_rms_test']:.2f}±{r['cal_rms_test_sd']:.2f}  |offset err|={r['offset_err']:.2f}")
