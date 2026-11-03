# Deploying, and the two things that need a server

Everything here stays inside your own Cloudflare account. No third-party
analytics service, and nothing in any address names a person.

---

## 1. Put the site up (Cloudflare Pages)

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages →
   Upload assets**.
2. Name the project. **Pick a neutral name** — it becomes the public address,
   `https://<name>.pages.dev`. `groundwave-lab` or `propagation-lab` is fine.
   Do not use your own name here: this is the only place a name could leak.
3. Upload this whole folder (not just `index.html` — `functions/` has to come
   too, or the visit counter will not exist).
4. **Deploy site.** The link works immediately.

To publish a new version later, open the project → **Create deployment** →
upload the folder again. Old deployments stay available to roll back to.

---

## 2. Switch on the counter AND the feedback form

Both are already wired: `/api/visits` and `/api/feedback`, answered by the
two files in `functions/api/`. They share one KV namespace, so **one binding
switches both on**. Cloudflare Pages runs that file by
itself, so there is no Worker to deploy and no address to paste anywhere.

One binding has to be added by hand, once:

1. Your Pages project → **Settings → Bindings → Add → KV namespace**
2. Variable name: `VISITS`
3. KV namespace: **`groundwave-visits`** (already created in your account)
4. Save, then **Deployments → Retry deployment** so the binding takes effect.

Open the site. The line above the footer should read **"1 visits"**, then
climb. Until the binding exists the line stays hidden — the lab shows nothing
rather than a number it cannot stand behind.

### What it does and does not do

- Counts **page opens**, not people. A laptop and a phone are two.
- No cookie, no address, nothing about anyone is stored. One integer.
- Not tamper-proof. Good for "is this being used?", not evidence for a report.
- If `/api/visits` cannot be reached the line hides rather than showing a
  stale number.

### Reading the feedback

Cloudflare dashboard -> **Workers & Pages -> KV -> groundwave-visits**. Every
response is a key beginning `fb:`, holding JSON with the date, which activity
the student had just finished, their rating, what confused them, what they
would add, and their year or course if they gave it. `fb:count` is the running
total.

The form asks for **no name, no email and no address**, so there is nothing
identifying to protect and nothing to declare beyond the answers themselves.

An alternative standalone Worker (`visit-counter-worker.js`) is included if
you would rather host the counter apart from the site. You do not need it.

---

## 3. If you would rather use Google Forms

The built-in form needs nothing extra, but if your lecturer wants responses in
a spreadsheet, open `index.html`, find `var ENGAGE`, and point it at a form:

```js
feedback: { mode: "external", url: "https://forms.gle/YOURFORMID", label: "Tell us how it went (2 minutes)" }
```

**When the prompt appears:** after a student moves on from a guided experiment,
or submits the quiz. Once only, dismissible, never blocking. A permanent
"Give feedback" link also sits above the footer.

---

## Staying anonymous

- The Pages project name is the only thing that becomes public. Keep it about
  the subject, not the author.
- The counter path is relative (`/api/visits`), so no `workers.dev` subdomain
  appears anywhere.
- No analytics service, no account outside your own, no personal data stored.
- If you later add a custom domain, that is the one other public name to pick
  carefully.
