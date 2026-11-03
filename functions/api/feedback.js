/**
 * Groundwave Lab — feedback collection, as a Cloudflare Pages Function.
 *
 * Shares the one KV binding with the visit counter, so adding that single
 * binding switches on both of the things the lecturer asked for.
 *
 *   Pages project → Settings → Bindings → Add → KV namespace
 *     Variable name: VISITS
 *     KV namespace:  groundwave-visits
 *
 * POST /api/feedback   body {activity, rating, confusing, missing, course}
 *                      -> {"ok": true}
 * GET  /api/feedback   -> {"count": n}      how many responses so far
 *
 * Deliberately collects no name, no email and no address. Nothing here
 * identifies a student, so there is nothing to disclose or to keep secure
 * beyond the answers themselves. Read the answers in the Cloudflare
 * dashboard: Workers & Pages → KV → groundwave-visits (keys begin "fb:").
 */

const MAX_FIELD = 600;      // one answer
const MAX_BODY = 4000;      // whole submission

function clean(v) {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD);
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function onRequestGet({ env }) {
  if (!env.VISITS) return json({ error: "KV binding VISITS is not set" }, 503);
  const n = parseInt((await env.VISITS.get("fb:count")) || "0", 10);
  return json({ count: Number.isFinite(n) ? n : 0 });
}

export async function onRequestPost({ request, env }) {
  if (!env.VISITS) return json({ error: "KV binding VISITS is not set" }, 503);

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "too long" }, 413);
    body = JSON.parse(text);
  } catch (e) {
    return json({ error: "expected JSON" }, 400);
  }

  const entry = {
    at: new Date().toISOString(),
    activity: clean(body.activity),
    rating: clean(body.rating),
    confusing: clean(body.confusing),
    missing: clean(body.missing),
    course: clean(body.course),
  };

  // Something must have been said, or it is an empty submission.
  if (!entry.rating && !entry.confusing && !entry.missing) {
    return json({ error: "nothing to record" }, 400);
  }

  const id = "fb:" + entry.at + "-" + Math.random().toString(36).slice(2, 8);
  await env.VISITS.put(id, JSON.stringify(entry));

  let n = parseInt((await env.VISITS.get("fb:count")) || "0", 10);
  if (!Number.isFinite(n) || n < 0) n = 0;
  await env.VISITS.put("fb:count", String(n + 1));

  return json({ ok: true, count: n + 1 });
}
