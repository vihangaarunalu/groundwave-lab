/**
 * Groundwave Lab — live measurement link for the Digital Shadow tab,
 * as a Cloudflare Pages Function at /api/measure.
 *
 * Any data source can stream readings here: today a MATLAB / Scilab /
 * Octave sensor emulator (software-in-the-loop), later the real SDR
 * sensor stations. The page polls the same channel and shows the readings.
 *
 * Storage (recommended): a D1 database bound as MEASURE_DB. It is strongly
 * consistent, so no reading is lost when uploads reach different
 * Cloudflare locations. Tables are created automatically.
 *   Workers & Pages → D1 → Create database "groundwave-measure", then
 *   Pages project → Settings → Bindings → Add → D1 database
 *     Variable name: MEASURE_DB   Database: groundwave-measure
 *   and retry the latest deployment.
 * Fallback: the KV namespace bound as VISITS. KV is eventually consistent,
 * so with KV some readings can be overwritten when two uploads land in
 * different locations; use D1 for experiments.
 *
 * A "channel" is a name both sides agree on, e.g. "wisdom-lab1".
 * Optional: set a secret MEASURE_KEY (Settings → Variables and Secrets);
 * then senders must add the header  Authorization: Bearer <MEASURE_KEY>.
 *
 *   POST /api/measure?ch=wisdom-lab1
 *        body {"tx":{...optional station...}, "readings":[{...}, ...]}
 *        or a single reading object
 *        reading: {t, sensor, lat, lon, f_mhz, level, h, built, indoor, fixed, src}
 *          level = field strength in dBµV/m; h = antenna height above ground, m
 *          src   = "matlab" | "scilab" | "octave" | "sdr" | ...
 *        -> {"ok": true, "stored": n, "total": m}
 *   GET  /api/measure?ch=wisdom-lab1&since=<epoch ms>
 *        -> {"readings":[...], "tx":{...}|null, "now": <epoch ms>}
 *   DELETE /api/measure?ch=wisdom-lab1   (same key rules as POST)
 *        -> {"ok": true}
 *
 * Keeps the newest 2000 readings per channel for 7 days. Stores no
 * personal data. KV is eventually consistent: a reading written in one
 * Cloudflare location shows at once there, and elsewhere within ~60 s.
 */

const MAX_KEEP = 2000, MAX_POST = 300, TTL = 7 * 24 * 3600;
const CH_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  },
});

const kv = (env) => env.MEASURE || env.VISITS || null;
const db = (env) => env.MEASURE_DB || null;
async function ensureTables(d) {
  await d.batch([
    d.prepare("CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY AUTOINCREMENT, ch TEXT NOT NULL, rt INTEGER, t INTEGER, sensor TEXT, lat REAL, lon REAL, level REAL, f_mhz REAL, h REAL, built INTEGER, fixed INTEGER, src TEXT)"),
    d.prepare("CREATE INDEX IF NOT EXISTS readings_ch_id ON readings (ch, id)"),
    d.prepare("CREATE TABLE IF NOT EXISTS stations (ch TEXT PRIMARY KEY, tx TEXT, updated INTEGER)"),
  ]);
  try { await d.prepare("ALTER TABLE readings ADD COLUMN indoor INTEGER").run(); } catch (e) { /* already there */ }
}
const rowOut = (r) => ({ id: r.id, rt: r.rt, t: r.t, sensor: r.sensor, lat: r.lat, lon: r.lon, level: r.level, f_mhz: r.f_mhz, h: r.h, built: !!r.built, indoor: !!r.indoor, fixed: !!r.fixed, src: r.src });
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };
const str = (v, n) => (typeof v === "string" ? v.replace(/[^\w .:+\-·()/]/g, "").slice(0, n) : "");

function cleanReading(r, now) {
  if (!r || typeof r !== "object") return null;
  const lat = num(r.lat, -90, 90), lon = num(r.lon, -180, 180), level = num(r.level, -60, 200);
  if (lat === null || lon === null || level === null) return null;
  const t = Date.parse(r.t);
  return {
    t: Number.isFinite(t) ? t : now,
    rt: now,                                   // time the server received it
    sensor: str(r.sensor, 40) || "sensor",
    lat, lon, level,
    f_mhz: num(r.f_mhz, 0.01, 100000),
    h: num(r.h, 0, 1000) ?? 1.5,
    built: r.built === true || r.built === 1 || r.built === "1",
    indoor: r.indoor === true || r.indoor === 1 || r.indoor === "1",
    fixed: r.fixed === true || r.fixed === 1 || r.fixed === "1",
    src: str(r.src, 16) || "unknown",
  };
}
function cleanTx(tx) {
  if (!tx || typeof tx !== "object") return null;
  const lat = num(tx.lat, -90, 90), lon = num(tx.lon, -180, 180);
  if (lat === null || lon === null) return null;
  return { name: str(tx.name, 60) || "Transmitter", lat, lon, h: num(tx.h, 1, 1000) ?? 30, f_mhz: num(tx.f_mhz, 0.01, 100000), erp_kw: num(tx.erp_kw, 0.000001, 10000) };
}
function sameKey(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function allowed(request, env) {
  if (!env.MEASURE_KEY) return true;
  const h = request.headers.get("Authorization") || "";
  return sameKey(h.startsWith("Bearer ") ? h.slice(7) : "", env.MEASURE_KEY);
}
function channel(request) { const ch = (new URL(request.url).searchParams.get("ch") || "").toLowerCase(); return CH_RE.test(ch) ? ch : null; }
async function load(store, ch) { try { return JSON.parse((await store.get("ms:" + ch)) || "null") || { tx: null, r: [] }; } catch (e) { return { tx: null, r: [] }; } }

export async function onRequestOptions() { return json({ ok: true }); }

export async function onRequestGet({ request, env }) {
  const d = db(env);
  if (d) {
    const ch = channel(request); if (!ch) return json({ error: "Give a channel name: 3–40 lowercase letters, digits or dashes" }, 400);
    await ensureTables(d);
    const after = Number(new URL(request.url).searchParams.get("after")) || 0;
    const rows = (await d.prepare("SELECT * FROM readings WHERE ch = ? AND id > ? ORDER BY id LIMIT 2000").bind(ch, after).all()).results || [];
    const st = await d.prepare("SELECT tx FROM stations WHERE ch = ?").bind(ch).first();
    return json({ readings: rows.map(rowOut), tx: st ? JSON.parse(st.tx) : null, cursor: rows.length ? rows[rows.length - 1].id : after, store: "d1", now: Date.now() });
  }
  const store = kv(env); if (!store) return json({ error: "Storage is not switched on (KV binding VISITS)" }, 503);
  const ch = channel(request); if (!ch) return json({ error: "Give a channel name: 3–40 lowercase letters, digits or dashes" }, 400);
  const since = Number(new URL(request.url).searchParams.get("since")) || 0;
  const data = await load(store, ch);
  return json({ readings: data.r.filter((x) => x.rt > since), tx: data.tx, store: "kv", now: Date.now() });
}

export async function onRequestPost({ request, env }) {
  const store = kv(env), d = db(env); if (!store && !d) return json({ error: "Storage is not switched on (D1 binding MEASURE_DB, or KV binding VISITS)" }, 503);
  const ch = channel(request); if (!ch) return json({ error: "Give a channel name: 3–40 lowercase letters, digits or dashes" }, 400);
  if (!allowed(request, env)) return json({ error: "Wrong or missing key" }, 401);
  let body; try { const text = await request.text(); if (text.length > 200000) return json({ error: "too large" }, 413); body = JSON.parse(text); } catch (e) { return json({ error: "expected JSON" }, 400); }
  const now = Date.now(), list = Array.isArray(body) ? body : Array.isArray(body.readings) ? body.readings
    : body.readings && typeof body.readings === "object" ? [body.readings]   // MATLAB encodes a 1-element struct array as an object
    : body.readings !== undefined ? [] : [body];
  const add = list.slice(0, MAX_POST).map((r) => cleanReading(r, now)).filter(Boolean);
  if (d) {
    const tx = cleanTx(body.tx);
    if (!add.length && !tx) return json({ error: "No valid readings: each needs lat, lon and level (dBµV/m)" }, 400);
    await ensureTables(d);
    const ins = d.prepare("INSERT INTO readings (ch, rt, t, sensor, lat, lon, level, f_mhz, h, built, indoor, fixed, src) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const ops = add.map((r) => ins.bind(ch, r.rt, r.t, r.sensor, r.lat, r.lon, r.level, r.f_mhz, r.h, r.built ? 1 : 0, r.indoor ? 1 : 0, r.fixed ? 1 : 0, r.src));
    if (tx) ops.push(d.prepare("INSERT INTO stations (ch, tx, updated) VALUES (?, ?, ?) ON CONFLICT(ch) DO UPDATE SET tx = excluded.tx, updated = excluded.updated").bind(ch, JSON.stringify(tx), now));
    if (Math.random() < 0.02) ops.push(d.prepare("DELETE FROM readings WHERE rt < ?").bind(now - TTL * 1000));
    if (ops.length) await d.batch(ops);
    const c = await d.prepare("SELECT COUNT(*) AS n FROM readings WHERE ch = ?").bind(ch).first();
    return json({ ok: true, stored: add.length, total: c ? c.n : add.length, store: "d1" });
  }
  const data = await load(store, ch);
  const tx = cleanTx(body.tx); if (tx) data.tx = tx;
  if (!add.length && !tx) return json({ error: "No valid readings: each needs lat, lon and level (dBµV/m)" }, 400);
  data.r = data.r.concat(add).slice(-MAX_KEEP);
  await store.put("ms:" + ch, JSON.stringify(data), { expirationTtl: TTL });
  return json({ ok: true, stored: add.length, total: data.r.length, store: "kv" });
}

export async function onRequestDelete({ request, env }) {
  const store = kv(env), d = db(env); if (!store && !d) return json({ error: "Storage is not switched on" }, 503);
  const ch = channel(request); if (!ch) return json({ error: "bad channel" }, 400);
  if (!allowed(request, env)) return json({ error: "Wrong or missing key" }, 401);
  if (d) { await ensureTables(d); await d.batch([d.prepare("DELETE FROM readings WHERE ch = ?").bind(ch), d.prepare("DELETE FROM stations WHERE ch = ?").bind(ch)]); return json({ ok: true }); }
  await store.delete("ms:" + ch);
  return json({ ok: true });
}
