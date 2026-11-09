/**
 * Groundwave Lab — feedback collection and the staff inbox, as a Cloudflare
 * Pages Function.
 *
 * Storage: the KV namespace bound as VISITS (shared with the visit counter).
 *   Pages project → Settings → Bindings → Add → KV namespace
 *     Variable name: VISITS      KV namespace: groundwave-visits
 *
 * Staff access: a secret bound as FEEDBACK_KEY.
 *   Pages project → Settings → Variables and Secrets → Add → Secret
 *     Name: FEEDBACK_KEY         Value: a long passphrase you choose
 *   Anyone with the passphrase can read and delete feedback at /feedback.html.
 *
 * Public (students):
 *   POST /api/feedback             body {activity, page, rating, confusing, missing, course}
 *                                  -> {"ok": true, "count": n}
 *   GET  /api/feedback             -> {"count": n}
 *
 * Staff (header  Authorization: Bearer <FEEDBACK_KEY>):
 *   GET    /api/feedback?list=1[&cursor=…]  -> {"items":[…], "cursor": "…"|null, "count": n}
 *   PATCH  /api/feedback?id=fb:…   body {"reviewed": true|false}  -> {"ok": true}
 *   DELETE /api/feedback?id=fb:…   -> {"ok": true, "count": n}
 *
 * Deliberately collects no name, no email and no address. Nothing here
 * identifies a student.
 */

const MAX_FIELD = 600;      // one answer
const MAX_BODY = 4000;      // whole submission
const PAGE = 100;           // entries per list page
const RATINGS = ["a lot", "somewhat", "not really"];

function clean(v, max = MAX_FIELD) {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

async function readCount(kv) {
  const n = parseInt((await kv.get("fb:count")) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* Compare the presented key with FEEDBACK_KEY in constant time (by hashing both). */
async function isStaff(request, env) {
  if (!env.FEEDBACK_KEY) return false;
  const h = request.headers.get("Authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(env.FEEDBACK_KEY)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function guard(request, env) {
  if (!env.VISITS) return json({ error: "KV binding VISITS is not set" }, 503);
  if (!env.FEEDBACK_KEY) return json({ error: "Secret FEEDBACK_KEY is not set" }, 503);
  if (!(await isStaff(request, env))) return json({ error: "Wrong or missing passphrase" }, 401);
  return null;
}

const validId = (id) => typeof id === "string" && /^fb:20\d\d-[0-9T:.\-Z]+-[a-z0-9]{1,12}$/.test(id);

export async function onRequestGet({ request, env }) {
  if (!env.VISITS) return json({ error: "KV binding VISITS is not set" }, 503);
  const url = new URL(request.url);

  if (!url.searchParams.has("list")) return json({ count: await readCount(env.VISITS) });

  const denied = await guard(request, env);
  if (denied) return denied;

  // Entry keys are "fb:<ISO time>-<rand>", so they list in time order.
  const page = await env.VISITS.list({ prefix: "fb:20", limit: PAGE, cursor: url.searchParams.get("cursor") || undefined });
  const items = [];
  for (let i = 0; i < page.keys.length; i += 25) {
    const batch = page.keys.slice(i, i + 25);
    const vals = await Promise.all(batch.map((k) => env.VISITS.get(k.name)));
    vals.forEach((v, j) => {
      if (!v) return;
      try { items.push(Object.assign({ id: batch[j].name }, JSON.parse(v))); } catch (e) { /* skip a damaged entry */ }
    });
  }
  return json({ items, cursor: page.list_complete ? null : page.cursor, count: await readCount(env.VISITS) });
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

  const rating = clean(body.rating, 20);
  const entry = {
    at: new Date().toISOString(),
    activity: clean(body.activity, 80),
    page: clean(body.page, 40),
    rating: RATINGS.includes(rating) ? rating : "",
    confusing: clean(body.confusing),
    missing: clean(body.missing),
    course: clean(body.course, 60),
    reviewed: false,
  };

  // Something must have been said, or it is an empty submission.
  if (!entry.rating && !entry.confusing && !entry.missing) {
    return json({ error: "nothing to record" }, 400);
  }

  const id = "fb:" + entry.at + "-" + Math.random().toString(36).slice(2, 8);
  await env.VISITS.put(id, JSON.stringify(entry));

  const n = (await readCount(env.VISITS)) + 1;
  await env.VISITS.put("fb:count", String(n));

  return json({ ok: true, count: n });
}

export async function onRequestPatch({ request, env }) {
  const denied = await guard(request, env);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return json({ error: "unknown entry" }, 400);
  const raw = await env.VISITS.get(id);
  if (!raw) return json({ error: "That entry no longer exists" }, 404);
  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: "expected JSON" }, 400); }
  const entry = JSON.parse(raw);
  entry.reviewed = body.reviewed === true;
  await env.VISITS.put(id, JSON.stringify(entry));
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const denied = await guard(request, env);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return json({ error: "unknown entry" }, 400);
  if (!(await env.VISITS.get(id))) return json({ error: "That entry no longer exists" }, 404);
  await env.VISITS.delete(id);
  const n = Math.max(0, (await readCount(env.VISITS)) - 1);
  await env.VISITS.put("fb:count", String(n));
  return json({ ok: true, count: n });
}
