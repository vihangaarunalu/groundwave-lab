"""Learning cycle of the digital-shadow laboratory (Predict-Observe-Explain + calibrate), black and white, 300 dpi."""
import sys, math, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle
out = sys.argv[1] if len(sys.argv) > 1 else "fig_learning_cycle.png"
plt.rcParams.update({"font.family": "DejaVu Sans"})
fig, ax = plt.subplots(figsize=(3.5, 3.05), dpi=300); ax.set_xlim(-50, 50); ax.set_ylim(-44, 44); ax.axis("off"); ax.set_aspect("equal")
ax.add_patch(Circle((0, 0), 13.5, fc="0.9", ec="black", lw=0.7))
ax.text(0, 2.5, "Digital", ha="center", va="center", fontsize=6.6, fontweight="bold"); ax.text(0, -2.5, "shadow", ha="center", va="center", fontsize=6.6, fontweight="bold")
B = [(0, 30, "1. PREDICT", ["equation-only result", "(ITU-R models)"], "POE: predict"),
     (31, 0, "2. OBSERVE", ["readings arrive via", "the interface"], "Kolb: concrete experience"),
     (0, -30, "3. EXPLAIN", ["error map: which", "physical cause?"], "Kolb: reflection, concept"),
     (-31, 0, "4. CALIBRATE", ["fit corrections, test", "on unseen points"], "Kolb: active experimentation")]
for x, y, t, l, k in B:
    w, h = 36, 17
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.4,rounding_size=1.5", fc="white", ec="black", lw=0.7))
    ax.text(x, y + 5.2, t, ha="center", va="center", fontsize=6.0, fontweight="bold")
    ax.text(x, y + 0.9, l[0], ha="center", va="center", fontsize=5.3); ax.text(x, y - 2.6, l[1], ha="center", va="center", fontsize=5.3)
    ax.text(x, y - 6.2, k, ha="center", va="center", fontsize=4.6, style="italic", color="0.3")
for a in (45, -45, -135, 135):
    r = 27; t0 = math.radians(a + 14); t1 = math.radians(a - 14)
    ax.add_patch(FancyArrowPatch((r * math.cos(t0), r * math.sin(t0)), (r * math.cos(t1), r * math.sin(t1)), connectionstyle="arc3,rad=-0.35", arrowstyle="-|>", mutation_scale=7, lw=0.8, color="black"))
fig.savefig(out, bbox_inches="tight", pad_inches=0.02)
