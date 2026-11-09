/**
 * Groundwave Lab — visit counter, as a Cloudflare Pages Function.
 *
 * Because this file sits in the uploaded site, Cloudflare Pages runs it
 * automatically at /api/visits. There is no separate Worker to deploy and
 * no address to paste into the page: the lab calls the relative path, so
 * nothing in any URL names a person or a project owner.
 *
 * One thing must be set by hand, once:
 *   Pages project → Settings → Bindings → Add → KV namespace
 *     Variable name: VISITS
 *     KV namespace:  groundwave-visits
 *   then redeploy (Deployments → Retry deployment).
 *
 * Until that binding exists this returns 503 and the lab simply hides the
 * counter line, rather than showing a number it cannot stand behind.
 *
 * Stores one integer. No cookie, no address, nothing about anyone.
 *
 * GET /api/visits        -> {"ok": true}   counts this visit
 * GET /api/visits?peek=1 with  Authorization: Bearer <staff passphrase>
 *                         -> {"count": n}   without counting (Feedback inbox)
 */

/* The total is for staff: the same passphrase as the Feedback inbox
   (the FEEDBACK_KEY secret, or the "fb:admin" record created on first visit). */
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha(t) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(t))); }
function same(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function isStaff(request, env) {
  const h = request.headers.get("Authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!given) return false;
  if (env.FEEDBACK_KEY) return same(await sha(given), await sha(env.FEEDBACK_KEY));
  let rec = null; try { rec = JSON.parse((await env.VISITS.get("fb:admin")) || "null"); } catch (e) {}
  return !!rec && same(await sha(rec.salt + ":" + given), rec.hash);
}

export async function onRequestGet({ request, env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  if (!env.VISITS) {
    return new Response(
      JSON.stringify({ error: "KV binding VISITS is not set on this Pages project" }),
      { status: 503, headers }
    );
  }

  const peek = new URL(request.url).searchParams.has("peek");
  let n = parseInt((await env.VISITS.get("total")) || "0", 10);
  if (!Number.isFinite(n) || n < 0) n = 0;

  if (!peek) {
    n += 1;
    // Not atomic: two opens in the same instant can share a number. For a
    // teaching tool that is fine, and it never over-counts.
    await env.VISITS.put("total", String(n));
  }

  // Only staff see the number; everyone else just gets their visit counted.
  if (!(await isStaff(request, env))) return new Response(JSON.stringify({ ok: true }), { headers });
  return new Response(JSON.stringify({ count: n }), { headers });
}
