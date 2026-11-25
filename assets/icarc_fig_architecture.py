"""Fig. 1 of the ICARC paper: data sources, measurement interface and digital shadow (black and white, 300 dpi)."""
import sys, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
out = sys.argv[1] if len(sys.argv) > 1 else "fig_architecture.png"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 6.2})
fig, ax = plt.subplots(figsize=(7.16, 3.3), dpi=300); ax.set_xlim(0, 100); ax.set_ylim(0, 46); ax.axis("off")
def box(x, y, w, h, title, lines=(), fill="white", bold=True):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.25,rounding_size=0.8", fc=fill, ec="black", lw=0.7))
    ax.text(x + w / 2, y + h - 1.3, title, ha="center", va="top", fontweight="bold" if bold else "normal", fontsize=6.6)
    for i, l in enumerate(lines): ax.text(x + w / 2, y + h - 3.9 - i * 2.05, l, ha="center", va="top", fontsize=5.7)
def arrow(x1, y1, x2, y2, label=None, dy=1.0):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=7, lw=0.7, color="black"))
    if label: ax.text((x1 + x2) / 2, (y1 + y2) / 2 + dy, label, ha="center", fontsize=5.3, style="italic")
ax.text(13, 45, "DATA SOURCES", ha="center", fontsize=6.5, fontweight="bold")
box(0.5, 34, 25, 9.5, "External simulator", ["MATLAB / Octave sensor model", "(this paper: scenarios S0–S4)"], fill="0.92")
box(0.5, 22.5, 25, 10, "Physical sensors", ["SDR, RTL-SDR or field meter", "→ local gateway via serial,", "USB or TCP socket"])
box(0.5, 11.5, 25, 9.5, "Third-party apps and APIs", ["phone logger app (RSRP),", "webhook, cloud IoT platform"])
box(0.5, 1, 25, 9, "Remote invocation", ["curl, Python requests,", "MATLAB webwrite()"])
box(33, 12, 24, 23, "Measurement interface", ["HTTPS REST", "POST / GET /api/measure?ch=…", "JSON reading: lat, lon,", "level (dBµV/m), f, h,", "building / indoor flags,", "source, time stamp", "optional bearer key", "storage: D1 (SQL) or KV"], fill="0.92")
for y in (38.5, 27.5, 16, 5.5): arrow(26, y, 32.6, 23.5)
box(64, 28, 35.5, 15, "Equation-only engine (ITU-R)", ["P.368, P.1147, P.1812, P.526, P.525,", "P.2108, P.2109, P.530, P.453", "terrain (DEM), OSM buildings,", "live weather, space weather"])
box(64, 3, 35.5, 21, "Digital shadow (browser)", ["1. ingest readings (poll every 3 s)", "2. compare: e = measured − equation", "3. least-squares calibration:", "    offset, building, indoor, trend", "4. hold-out test, error statistics", "5. map, profile and animation views"], fill="0.92")
arrow(57.4, 21, 63.6, 15, "readings", dy=2.2)
arrow(81.75, 27.6, 81.75, 24.4, None)
ax.text(83, 25.4, "predictions", fontsize=5.3, style="italic")
fig.savefig(out, bbox_inches="tight", pad_inches=0.02)
