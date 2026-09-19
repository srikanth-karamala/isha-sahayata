# Handoff — Isha Sahayata

Written 19 September 2026, at the end of the session that added the AI features,
Lost & Found, the staff console and the rename. This covers **why** things are
the way they are and **what is still open**. For what the product does, see
`README.md`.

---

## What the app is now

It started as Yellow Cycle, a campus bike-share. It now carries two services:

- **Cycles** — scan to unlock, ride, drop at any hub, report faults
- **Lost & Found** — report what you lost, hand in what you found, and the
  system works out which pairs describe the same object

Hence the rename: "Yellow Cycle" named one feature out of two.

---

## Where the AI is, and how honest to be about it

Three call sites, all behind `lib/ai.ts`:

| Module | What it does | Could it exist without AI? |
| --- | --- | --- |
| `lib/triage.ts` | Fault report (+ photo) → category, severity, safe-to-ride, summary | Yes, worse. Staff could triage by hand. |
| `lib/briefing.ts` | Day's aggregates → 2-4 specific staff actions | Yes, worse. A coordinator could read the charts. |
| `lib/lost-found.ts` | Scores whether a lost and a found report are the same object | **No.** This is the load-bearing one. |

**Do not overclaim this as an AI-native app.** Two features are well-integrated
assists; one genuinely could not be built without a model. That distinction is
more persuasive than a blanket claim, and it is measurable:

```
Same lost bottle, same candidates:
  Offline rules  35%  "Same category, 0 matching words in the descriptions."
  Groq           68%  "Both describe a dark metal container (bottle/flask)
                       with surface damage, the timing and material align."
```

A second pair scored 92% ("spectacles, thin frame, brown cover" against
"reading glasses in a brown case") while keys, a shawl and a phone charger all
scored 0% — so the model is reading objects, not just being generous.

Below the display threshold a rider would never have seen the bottle match at
all. That is the argument for the feature.

---

## Providers

`lib/ai.ts` is the only place that talks to a model. It picks by environment:

```
ANTHROPIC_API_KEY  → claude-opus-5
GROQ_API_KEY       → openai/gpt-oss-120b, or qwen/qwen3.8-27b when a photo is attached
neither            → each module's deterministic fallback
```

Anthropic wins if both are set. Badges in the UI name whichever answered, so
nobody is misled about what they are reading.

**Currently running on Groq** (free tier, no card). Three things were learned
only by running against a live account, all of which would have shipped broken:

1. The Llama 4 vision model named in Groq's docs **is not served** on this
   account. `qwen/qwen3.8-27b` is, and it accepts images — verified by sending
   a red square and getting back "Red". Photo triage works because of that.
2. `qwen/qwen3.8-27b` was initially dismissed as non-existent because it was
   missing from a scraped docs page. It is real. Check `/v1/models` against the
   actual key, not the documentation.
3. The matching prompt scored the bottle/flask pair at only **45%**, citing the
   vocabulary difference as a reason to doubt. It now states that two people
   describing one object rarely use the same words, and that a contradiction
   requires both reports to assert something incompatible. That moved the pair
   to 68-75% without raising unrelated items at all.

### Security note

During setup, TLS to `api.groq.com` was being intercepted — the certificate was
issued by `CN=192.168.99.254`, a device on the local network, not a real CA.
**The Groq key was transmitted over that connection at least once and should be
rotated.** If you hit `curl` exit code 60 or HTTP 000 again, that is the cause;
switch off the ashram network rather than disabling certificate validation.

---

## Decisions worth not re-litigating

**Maintenance queue sorts by danger, not time.** Unsafe first, then severity,
then oldest within a band. A cycle with failing brakes outranks one reported
earlier with a broken bell.

**Match suggestions are stored, not recomputed.** Scoring on every page load
would re-spend tokens to produce an unchanged answer. They are written in both
directions so either party sees them from their side, and confirming a reunion
closes both reports — an object has one owner.

**The staff console is deliberately not the rider app.** Flat opaque cards on a
cool ground, blue accent for data and actions, larger type. Isha amber is left
to mean brand rather than button. Scoped to `.yc-staff` in `globals.css` so
nothing leaks into the rider side.

**Severity is never colour alone.** Red, amber and green measure 1.7 ΔE apart
under deuteranopia — effectively identical to a red-green colourblind reader.
Every chip carries a text label and a dot whose weight encodes severity, and
each chip's ink clears WCAG AA on its fill. Do not "simplify" this back to
coloured text.

**Glass lost to legibility.** The rider app's frosted panels are lovely over the
map for a short list, but unusable for a form — satellite imagery showed through
the text boxes. Forms and the nav bar use `.yc-sheet-solid`.

**The seed rebalances toward a share of the fleet, not away from overflow.**
An earlier version of `prisma/seed-history.ts` only moved cycles out of hubs
that were *over* capacity. No hub ever exceeded its capacity, so nothing ever
moved, and the hubs the evening flow drains — Main Gate, Biksha Hall — sat at 0
and 1 cycles across the whole simulated history. On the map that reads as
broken data rather than as the imbalance it is. Redistribution now pulls each
hub toward a share proportional to its capacity, which is what staff actually
do. Keep some variation: a perfectly even fleet leaves the briefing with
nothing to say.

**Photos live in Postgres, not on disk.** `lib/uploads.ts` writes an `Upload`
row and returns `/api/uploads/<id>`; the route serves the bytes back. The
original version wrote into `public/uploads`, which works locally and fails on
serverless hosting where the filesystem is read-only. `repairCycle` *requires* a
photo, so that would have thrown on every repair confirmation in production —
a demo-killer that only surfaces once deployed. A bytea column was chosen over
object storage because these are phone snapshots of a few hundred kilobytes and
it needs no extra service or account.

**The map is not rendered on tabs that do not use it.** Report and Lost & Found
show a plain ground instead. This removes the 3D/locate/zoom controls with it
and avoids running a WebGL canvas behind an opaque panel.

---

## Traps that cost time

**Prisma client goes stale.** After `prisma migrate`, a running dev server still
holds the old client and new models silently return nothing. Restart the server,
not just the page. This looked like a broken server action for a while.

**`yc-btn-ghost` is `width: 100%`.** Put it next to a field with `shrink-0` and
it claims the entire row, collapsing the input to its padding. Use the
`.is-icon` variant. This was misdiagnosed as a flex-basis problem for several
attempts.

**MapLibre's "cannot fit within canvas" came from `fitBounds`, not `maxBounds`.**
The hubs sit close enough that framing them wants a zoom above `maxZoom`, so
`cameraForBounds` clamped and warned even though the framing was correct.
Computing the camera and applying it with `easeTo` skips the check. A whole
Mercator zoom-floor calculation was written against the wrong theory first —
**trace the stack before forming a hypothesis.**

**Consecutive conditional siblings are a list to React.** Three
`{tab === 'x' && panel}` lines in one wrapper make React ask for keys. Resolve
to a single node through a lookup.

**`lib/*.ts` must import each other relatively, not through `@/`.** The Prisma
seed imports `fallbackTriage` from `lib/triage.ts` and runs under ts-node,
which does not resolve the `@/` alias. An `@/lib/ai` import there breaks
`pnpm db:history` with a module-not-found error that points at the seed rather
than the real cause.

**`pnpm db:history` deletes users, so lost-and-found rows must go first.**
Those rows carry a foreign key to `User`. The delete order in the seed matters,
and the failure message names the constraint rather than the ordering.

**SQLite stored `DateTime` as epoch milliseconds** in the older Hackathon copy of
this project, so raw-SQL date grouping needs `/1000` first. Not an issue on
Postgres, but relevant if you open that repo.

---

## Data

Everything in the database is generated. Nothing came from a real person.

- **6 hubs** — real OpenStreetMap coordinates of the ashram, from `prisma/seed.ts`
- **60 cycles, ~1,300 rides, ~2,600 audit logs** — `prisma/seed-history.ts`,
  21 days of history built from per-hour demand weights and per-hub origin and
  destination preferences, so the demand curve has the campus rhythm in it
  (5am sadhana, midday meal at Biksha Hall, evening return) rather than noise
- **7 lost & found reports**, written to include one deliberately hard pair
  (black steel bottle vs dark metal flask) that shares no words

`pnpm db:history` regenerates rides and cycles; it clears them first and
preserves hubs. The hub seed itself is `pnpm exec prisma db seed`.

The overnight redistribution step in the seed exists because without it the
evening pull toward the accommodation hubs compounds nightly and the whole fleet
ends up parked at two small stations.

---

## Deployment

See `DEPLOY.md` for the steps. Decisions taken:

- **Neon** for hosted Postgres — free tier, integrates with Vercel directly.
  Its free tier sleeps when idle, so open the link once before a demo to wake
  it.
- **Vercel** for hosting, deploying from a private GitHub repository.
  Private because `ADMIN_PASSCODE` is real.
- **Photos in the database** rather than Vercel Blob, so there is no second
  service to configure and local and deployed behaviour are identical.

Three environment variables are needed in Vercel: `DATABASE_URL`,
`ADMIN_PASSCODE`, `GROQ_API_KEY`.

Pointing local `.env` at Neon aims local development at production data — keep
the local connection string somewhere to switch back.

---

## Things that look like bugs but are not

**"First scan asks for your name and phone" is often invisible.** The hint under
the scan button only renders when there is no saved rider identity. Identity
lives in `localStorage` under `yc_rider_identity`, so once you have scanned once
on a browser it correctly disappears. To see it again, clear that key or open a
private window.

**Main Gate shows few cycles.** It has the largest capacity (40) and the seed
distributes proportionally, then the day's rides drain it. That is the
imbalance the morning briefing exists to flag, and it does.

---

## Still open

- **Lost & Found claiming is trust-based.** Confirming a reunion closes both
  reports with no verification that the claimant owns the object.
- **Staff access is a shared passcode**, not accounts. Fine for a pilot.
- **Match confidence was tuned against one pair.** More examples would be needed
  to tune it properly; the current prompt may be over-fitted to bottles.
- **17 pre-existing lint errors** in the rider UI, all from before this session.
  Nothing added by it. `pnpm lint` to see them.
- **Fedra Serif is named but not shipped.** `--serif` in `globals.css` lists
  `FedraSerifAStdBook` with no `@font-face` and no font file, so Trirong (the
  Google fallback) is what actually renders. Adding the licensed files would
  upgrade every heading at once, with no code change.
- **Naming for sections was proposed, not decided** — *Chakra* (चक्र, wheel) for
  cycles, *Punarmilan* (पुनर्मिलन, reunion) for Lost & Found.

---

## Running it

See `RUNNING.md`. The short version, verified on this machine:

```bash
cd "<project>"
docker start yellow-cycle-postgres
pnpm start -p 3001 -H 0.0.0.0
```

**Postgres runs in Docker**, not as a system service — container
`yellow-cycle-postgres`, host port 5434, data in the volume
`yellow_cycle_pg`. Without it running the app starts but returns 500 on every
page, which reads as a broken app rather than a missing database. Its restart
policy was `no` and is now `unless-stopped`, so it survives a reboot.

`.env` holds `DATABASE_URL`, `ADMIN_PASSCODE` and `GROQ_API_KEY`. It is
gitignored, is not tracked, and has never been committed — verified. The server
reads it at startup, so a key added while it is running has no effect until a
restart.

**No git remote is configured.** Everything is local. If you push, make the
repository private while `ADMIN_PASSCODE` is anything real.

---

## The other documents

| File | What it is for |
| --- | --- |
| `README.md` | What the product does and the rider/staff flows. Predates this session; still accurate on the cycles side. |
| `RUNNING.md` | How to start the app day to day, and what to do when it will not start. Every command in it was run before being written down. |
| `DEPLOY.md` | Getting it onto a public URL: Neon, GitHub, Vercel. Not started yet. |
| `HANDOFF.md` | This file — why things are the way they are, and what is still open. |
