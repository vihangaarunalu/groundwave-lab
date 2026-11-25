"""Analysis of the ICARC validation runs (Digital Shadow, measurement interface).

Inputs (in one folder):
  icarc-sent.csv          log written by icarc_validation.m (what the simulator sent, and the truth)
  pts-<channel>.csv       per-point export from the page after calibration (Shadow tab -> Export CSV)
  icarc-page-results.csv  calibration results from the page (Shadow tab -> Export results)
  icarc-runlog.json       receive times recorded by the browser harness (optional)
Outputs: icarc-summary.csv, icarc-coefficients.csv and figures fig_*.png (300 dpi).
Usage:  python3 icarc_analysis.py <folder>
"""
import csv, glob, json, math, os, statistics as st, sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

D = sys.argv[1] if len(sys.argv) > 1 else "."
NAMES = {"S0": "S0 ideal sensor,\nequation conditions", "S1": "S1 ideal sensor,\nother conditions",
         "S2": "S2 realistic sensor", "S3": "S3 realistic,\nclose-in reality", "S4": "S4 realistic,\ntwo-ray reality"}


def rd(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def rms(v):
    return math.sqrt(sum(x * x for x in v) / len(v)) if v else float("nan")


sent = rd(os.path.join(D, "icarc-sent.csv"))
runs = {}
for r in sent:
    runs.setdefault(r["channel"], {"scenario": r["scenario"], "rows": []})["rows"].append(r)

per_run = []
for ch, info in sorted(runs.items()):
    pts = rd(os.path.join(D, f"pts-{ch}.csv"))
    pts = [p for p in pts if p["source"] in ("live",)]
    e_eq = [float(p["measured_dBuV_m"]) - float(p["equation_only_dBuV_m"]) for p in pts]
    test = [p for p in pts if p["test_point"] == "1"]
    train = [p for p in pts if p["test_point"] != "1"]
    e_cal_test = [float(p["measured_dBuV_m"]) - float(p["calibrated_dBuV_m"]) for p in test]
    e_eq_test = [float(p["measured_dBuV_m"]) - float(p["equation_only_dBuV_m"]) for p in test]
    e_cal_train = [float(p["measured_dBuV_m"]) - float(p["calibrated_dBuV_m"]) for p in train]
    # interface integrity: value received by the page vs value sent by the simulator
    sent_by = {r["sensor"]: float(r["level_sent"]) for r in info["rows"]}
    rx = {p["name"].split(" · ")[0]: float(p["measured_dBuV_m"]) for p in pts}
    d_if = [abs(rx[k] - v) for k, v in sent_by.items() if k in rx]
    per_run.append({"channel": ch, "scenario": info["scenario"], "n_sent": len(info["rows"]), "n_received": len(pts),
                    "interface_max_abs_dB": max(d_if) if d_if else float("nan"),
                    "eq_mean": st.mean(e_eq), "eq_sd": st.stdev(e_eq), "eq_rms": rms(e_eq), "eq_max": max(abs(x) for x in e_eq),
                    "eq_rms_test": rms(e_eq_test), "cal_rms_train": rms(e_cal_train), "cal_rms_test": rms(e_cal_test),
                    "n_train": len(train), "n_test": len(test), "pts": pts})

summary = []
for sc in ["S0", "S1", "S2", "S3", "S4"]:
    R = [r for r in per_run if r["scenario"] == sc]
    if not R:
        continue
    m = lambda k: st.mean(r[k] for r in R)
    s = lambda k: st.stdev([r[k] for r in R]) if len(R) > 1 else 0.0
    summary.append({"scenario": sc, "runs": len(R), "readings": sum(r["n_received"] for r in R),
                    "interface_max_abs_dB": max(r["interface_max_abs_dB"] for r in R),
                    "eq_bias_dB": m("eq_mean"), "eq_sd_dB": m("eq_sd"), "eq_rms_dB": m("eq_rms"), "eq_rms_sd": s("eq_rms"),
                    "eq_max_abs_dB": max(r["eq_max"] for r in R),
                    "eq_rms_test_dB": m("eq_rms_test"), "cal_rms_train_dB": m("cal_rms_train"),
                    "cal_rms_test_dB": m("cal_rms_test"), "cal_rms_test_sd": s("cal_rms_test")})

with open(os.path.join(D, "icarc-summary.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(summary[0].keys()))
    w.writeheader()
    for r in summary:
        w.writerow({k: (f"{v:.4f}" if isinstance(v, float) else v) for k, v in r.items()})

# recovered coefficients vs truth (page results are in run order, same order as the channels)
res = rd(os.path.join(D, "icarc-page-results.csv"))
coef = []
for r, pr in zip(sorted(runs.items()), res):
    ch, info = r
    t = info["rows"][0]
    n = len(info["rows"])
    # the sensor adds calibration error and warm-up drift to the true offset (S2-S4)
    extra = 0.0 if info["scenario"] in ("S0", "S1") else 1.5 + 0.5 * ((n - 1) / 2 / 60)
    coef.append({"channel": ch, "scenario": info["scenario"],
                 "offset_true": float(t["offset"]) + extra, "offset_found": float(pr["offset_dB"]),
                 "building_true": float(t["built_loss"]), "building_found": float(pr["building_extra_dB"] or "nan"),
                 "indoor_true": float(t["indoor_loss"]), "indoor_found": float(pr["indoor_extra_dB"] or "nan"),
                 "trend_true": float(t["trend"]), "trend_found": float(pr["trend_dB_per_decade"] or "nan")})
with open(os.path.join(D, "icarc-coefficients.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(coef[0].keys()))
    w.writeheader()
    for r in coef:
        w.writerow({k: (f"{v:.3f}" if isinstance(v, float) else v) for k, v in r.items()})

# ---------------- figures ----------------
plt.rcParams.update({"font.family": "DejaVu Serif", "font.size": 8, "axes.linewidth": 0.6, "figure.dpi": 300})

# Fig. A: measured (through the interface) vs equation-only, S0 and S2
fig, axs = plt.subplots(1, 2, figsize=(3.5, 1.9), sharey=True)
for ax, sc, title in zip(axs, ["S0", "S2"], ["(a) S0: ideal sensor", "(b) S2: realistic sensor"]):
    pts = [p for r in per_run if r["scenario"] == sc for p in r["pts"]]
    x = [float(p["equation_only_dBuV_m"]) for p in pts]
    y = [float(p["measured_dBuV_m"]) for p in pts]
    lo, hi = 50, 120
    ax.plot([lo, hi], [lo, hi], color="0.4", lw=0.6, ls="--")
    ax.set_xticks([60, 80, 100, 120]); ax.set_yticks([60, 80, 100, 120])
    ax.scatter(x, y, s=2.5, color="black" if sc == "S0" else "0.35", linewidths=0)
    ax.set_xlim(lo, hi); ax.set_ylim(lo, hi); ax.set_title(title, fontsize=7.5)
    ax.set_xlabel("Equation-only (dBµV/m)", fontsize=7)
axs[0].set_ylabel("Received via interface (dBµV/m)", fontsize=7)
fig.tight_layout(pad=0.3)
fig.savefig(os.path.join(D, "fig_interface_vs_equation.png"))

# Fig. B: RMS error per scenario, equation-only vs calibrated (test points)
fig, ax = plt.subplots(figsize=(3.5, 2.0))
xs = range(len(summary))
b1 = [r["eq_rms_test_dB"] for r in summary]
b2 = [r["cal_rms_test_dB"] for r in summary]
e2 = [r["cal_rms_test_sd"] for r in summary]
ax.bar([i - 0.2 for i in xs], b1, width=0.38, color="0.75", edgecolor="black", lw=0.5, label="Equation only")
ax.bar([i + 0.2 for i in xs], b2, width=0.38, color="0.25", edgecolor="black", lw=0.5, yerr=e2, capsize=2, error_kw={"lw": 0.6}, label="Calibrated digital shadow")
lab = lambda v: f"{v:.3f}" if v < 0.1 else f"{v:.1f}"
for i, (a, c) in enumerate(zip(b1, b2)):
    ax.text(i - 0.2, a + 0.8, lab(a), ha="center", fontsize=5.5)
    ax.text(i + 0.2, c + 0.8 + (e2[i] or 0), lab(c), ha="center", fontsize=5.5)
ax.set_xticks(list(xs)); ax.set_xticklabels([r["scenario"] for r in summary])
ax.set_ylabel("RMS error, test points (dB)", fontsize=7)
ax.set_ylim(0, 38)
ax.legend(fontsize=6, frameon=False, loc="upper left")
ax.spines[["top", "right"]].set_visible(False)
fig.tight_layout(pad=0.3)
fig.savefig(os.path.join(D, "fig_rms_by_scenario.png"))

# Fig. C: error distributions (equation-only vs calibrated) for S2
fig, ax = plt.subplots(figsize=(3.5, 1.8))
pts = [p for r in per_run if r["scenario"] == "S2" for p in r["pts"] if p["test_point"] == "1"]
a = sorted(float(p["measured_dBuV_m"]) - float(p["equation_only_dBuV_m"]) for p in pts)
c = sorted(float(p["measured_dBuV_m"]) - float(p["calibrated_dBuV_m"]) for p in pts)
ax.plot(a, [i / len(a) for i in range(1, len(a) + 1)], color="0.55", lw=1.0, label="Equation only")
ax.plot(c, [i / len(c) for i in range(1, len(c) + 1)], color="black", lw=1.0, label="Calibrated")
ax.axvline(0, color="0.6", lw=0.5, ls=":")
ax.set_xlabel("Error, measured − predicted (dB), S2 test points", fontsize=7)
ax.set_ylabel("Cumulative fraction", fontsize=7)
ax.legend(fontsize=6, frameon=False)
fig.tight_layout(pad=0.3)
fig.savefig(os.path.join(D, "fig_error_cdf_s2.png"))

# console report
for r in summary:
    print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()})
for sc in ["S1", "S2"]:
    C = [c for c in coef if c["scenario"] == sc]
    for k in ["offset", "building", "indoor", "trend"]:
        f = [c[k + "_found"] for c in C if not math.isnan(c[k + "_found"])]
        print(sc, k, "true", round(C[0][k + "_true"], 2), "found mean", round(st.mean(f), 2) if f else None, "sd", round(st.stdev(f), 2) if len(f) > 1 else 0)
try:
    L = json.load(open(os.path.join(D, "icarc-runlog.json")))
    t = [x["tRecv"] for x in L]
    print("receive time ms: mean", round(st.mean(t)), "max", max(t), "n", len(t))
except FileNotFoundError:
    pass
