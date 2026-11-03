/**
 * Groundwave Lab — visit counter.
 *
 * A static page cannot count its own visits, so this tiny Worker keeps the
 * tally. It stores one number. It sets no cookie, reads no personal data and
 * logs no addresses, so there is nothing to disclose under a privacy notice
 * beyond "we count page opens".
 *
 * Deploy (about three minutes, free tier is plenty):
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker. Name it
 *      "groundwave-visits". Deploy the placeholder, then Edit code and paste
 *      this file over it.
 *   2. Settings → Bindings → Add → KV namespace.
 *        Variable name: VISITS
 *        KV namespace:  create one called "groundwave-visits"
 *   3. Deploy. Copy the worker address, e.g.
 *        https://groundwave-visits.<your-subdomain>.workers.dev
 *   4. In the lab's index.html find ENGAGE and set:
 *        counter: { mode: "worker", code: "", url: "https://…workers.dev/" }
 *
 * GET  /        -> {"count": 1234}            and counts this visit
 * GET  /?peek=1 -> {"count": 1234}            without counting
 */

const ALLOW = "*"; // tighten to your site's origin once it has one

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOW,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "GET only" }), { status: 405, headers: cors });
    }
    if (!env.VISITS) {
      return new Response(JSON.stringify({ error: "KV binding VISITS is missing" }), { status: 500, headers: cors });
    }

    const peek = new URL(request.url).searchParams.has("peek");
    let n = parseInt((await env.VISITS.get("total")) || "0", 10);
    if (!Number.isFinite(n) || n < 0) n = 0;

    if (!peek) {
      n += 1;
      // Not atomic: two visits in the same millisecond can land on the same
      // number. For a teaching tool that is fine, and it never over-counts.
      await env.VISITS.put("total", String(n));
    }

    return new Response(JSON.stringify({ count: n }), { headers: cors });
  },
};
