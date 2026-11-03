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
 * GET /api/visits        -> {"count": n}   and counts this visit
 * GET /api/visits?peek=1 -> {"count": n}   without counting
 */

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

  return new Response(JSON.stringify({ count: n }), { headers });
}
