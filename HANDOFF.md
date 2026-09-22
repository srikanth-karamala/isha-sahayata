# Handoff — Isha Sahayata

Written 19 September 2026, at the end of the session that added the AI features,
Lost & Found, the staff console and the rename. Revised 20 September, after the
session that added the introduction, the Ashram Info and Ride tabs, and the
location sanity check. This covers **why** things are the way they are and
**what is still open**. For what the product does, see `README.md`.

---

## What the app is now

It started as Yellow Cycle, a campus bike-share. The bottom nav now carries
four destinations:

- **Cycles** — scan to unlock, ride, drop at any hub. Reporting a fault is an
  action on this tab rather than a tab of its own: a fault is always about a
  cycle, and five tabs left each one about 75px wide on a phone. It keeps its
  standing as something reachable without unlocking a cycle first, which was
  the point of promoting it out of the checkout flow originally.
- **Ride** — shuttles and lifts. A stub, and it reads as one; see below.
- **Lost & Found** — report what you lost, hand in what you found, and the
  system works out which pairs describe the same object.
- **Info** — ashram timings, places, contacts and guidelines.

Hence the rename: "Yellow Cycle" named one feature out of four.

A first run now opens on an **introduction** between the splash and the map,
explaining what Sahayata is and listing what it can help with. Before it, a
first-time visitor landed on a campus map with no idea what the app was for,
and the tabs below Cycles were effectively undiscoverable. It is shown once per
device, tracked in `localStorage` under `sahayata_onboarded_v1` — separately
from rider identity, so clearing one does not replay the other.

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

## Decisions from the 20 September session

**The Info tab reads `lib/ashram-knowledge.ts` rather than holding its own
copy of the facts.** That file already existed as the assistant's source of
truth, with a three-state `verified` field. Duplicating the content would have
meant two places to correct when a timing changes, and a tab that could
contradict Sahayata AI on the same question.

It inherits that file's honesty rule as well: confirmed facts are stated
plainly, `unverified` ones are shown with a visible "NOT CHECKED" chip and a
caveat, and `PLACEHOLDER` entries are not rendered at all. **So a section can
legitimately be empty, and that is not a bug.** An empty section says "ask at
the desk", which is the right answer when nobody has confirmed the timing, and
far better than a confident number that sends someone across the campus for a
darshan that finished an hour ago. Eleven of the fourteen facts reach a visitor:
ten stated plainly and one carrying the "not checked" caveat. Three remain
placeholders.

**Ride is deliberately a stub.** The service needs its own data model —
vehicles, stops, timings, possibly requests with an accept/assign step and a
staff console — and three product questions answered before any of it: fixed
timetable or on-demand; who drives; whether a request needs accepting.
Guessing would have meant building the wrong thing twice. Both shuttle entries
in the knowledge file are `PLACEHOLDER`, so there is no honest timetable to
show either. When someone confirms them, they appear on that tab automatically.

**No persona picker at first run.** Suggested, and resisted: it adds a decision
before anyone sees value, people pick wrong, and it then needs a way to change
later. Everyone sees everything and the tabs do the sorting. Worth revisiting
only if the user stories show the flows genuinely diverge.

**"Step 1 · Find a dock" and "Step 2 · Riding" are gone.** They numbered a
journey most people do not walk in order — plenty open the app already standing
at a stand — and there was no step 3 to make the numbering mean anything.

**The assistant floats on every tab; reporting does not.** The assistant
answers a question about whatever is on screen — a timing on Info, an item on
Lost & Found — so it has to follow the reader. Reporting a fault was given the
same treatment and it was wrong: it is a cycle action, and someone reading the
ashram timings is not halfway through a thought about a broken cycle. A
permanent control over three unrelated tabs costs attention for a case that is
rare and already one tap away. It went back to Cycles only.

The Lost & Found actions were left in place for a related reason: "I lost
something" and "I found something" are that tab's primary content, not actions
that follow the reader, and demoting a tab's main choices to floating circles
would hide the tab's own purpose.

Both floating controls collapse to a circle and widen to their name on hover.
On a touch screen there is no hover, so they expand on arrival, hold, and
settle back — introducing themselves once without keeping the space.

**Motion is on the existing `--spring` curve, and all of it is disabled under
`prefers-reduced-motion`.** Tab changes need a keyed wrapper, because without
a key React reuses the DOM node across tabs and the entry animation never
runs again. The nav's selected pill is one element whose position is measured
rather than computed — the buttons are sized by their labels, and "Lost &
Found" is far wider than "Ride".

A horizontal slide between tabs was deliberately not added: it would imply the
tabs have an order and invite a swipe gesture that does not exist.

**Panels opened from inside a tab need a close control.** "Report a problem"
had none, so the only ways out of a half-filled form were to send it or switch
tabs — a dead end on the screen a rider is most likely to open by mistake.
`.yc-panel-close` exists to be reused by any later panel of that kind.

**A tab shows a count only when the count is about that tab.** Ride and Info
have none of their own, so the header stat block renders nothing there —
divider included, because an empty column with a rule beside it reads as
something failing to load — and the island takes a `quiet` mode that names
the app instead. The rule was already written above the header stat logic
and only covered Report and Lost & Found; the two newer tabs fell through to
the cycle count by omission. Worth checking whenever a tab is added.

**The splash holds until `showOnboarding` is no longer null**, not merely
until its own timer ends. That state starts null and is set once
localStorage has been read, so releasing the splash on the timer alone left
a gap with neither screen rendered and the app visible behind them. Worst
under `prefers-reduced-motion`, where the splash exits immediately.

---

## Decisions from the 22 September session

**The staff Overview shows a repair queue, not charts.** It opened with a
demand chart and six hub capacity bars. Both were honest and neither helped: on
a quiet campus the chart was a flat line along zero and the hub bars read
"Healthy" six times. It is now three counts — running, in repair, unsafe to
ride — over the cycles that are out of service, newest report first, laid out
like the Lost & Found board because the two pages answer the same shape of
question. The morning briefing stays; a model naming two or three actions is
advice rather than decoration.

**The Overview queue is newest-first while the Cycles tab stays danger-first.**
These orders disagree on purpose. Overview asks *what has just come in*, the
Cycles tab asks *what to fix next*, so a bell reported an hour ago can sit
above a brake failure from Tuesday. Severity is on every row either way. If
this is ever "corrected" to one order, decide which question the page answers
first.

**There is no repair-ticket history, and the Overview does not pretend
otherwise.** A fault lives on the `Cycle` row and is overwritten by the next
report, so `updatedAt` is the time of the *current* fault and nothing records
who raised it. That is why rows carry no reporter name or phone the way Lost &
Found rows do. Real tickets would need a `FaultReport` table, the report flow
rewired, and a migration — considered and deliberately not done for a list
view.

**Fault photos reach the staff pages and this was verified, not assumed.** The
chain is `saveUploadDataUrl` → `Upload` row → `/api/uploads/<id>` →
`issuePhotoUrl` → `getRepairQueue` → the `Thumb` in the row. Checked by
measuring `naturalWidth > 0` on the rendered thumbnails rather than by looking
at the markup: an `<img>` whose source 404s still renders as an element, so
counting tags proves nothing.

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

## Traps from the 20 September session

**A distance of 441 km looked like the model hallucinating. It was not.** The
assistant reported "Biksha Hall is 441 km south-west of you, about 5,653
minutes walk", and the obvious suspicion was Groq. The same 441 km appeared in
the dock list, which is computed by `lib/geo.ts` and never goes near a model —
the assistant is handed a pre-built string and repeats it. The device had
reported a position about 450 km away; the distance and bearing both match
Chennai. A desktop browser, or a phone on Wi-Fi rather than GPS, will report a
city-level location derived from an IP address and be completely confident
about it.

`isPlausibleCampusPosition()` in `lib/geo.ts` now rejects anything beyond 25 km
of the campus, plus a swapped lat/lng and a 0,0 fix. The radius is generous on
purpose: the campus is about 2 km across, but someone may open the app from
Coimbatore or the airport on the way in and still want to see availability.
**Apply it wherever a position enters a surface, not at each place a distance
is printed** — `MainDashboard` checks once into `origin`, which is what keeps
the dock list, header, island, drop-off and assistant agreeing with each other.

The lesson that generalises: when a number looks absurd, check whether the
same number appears somewhere the model cannot reach. It localises the fault in
one step.

**`rem` touch targets are 7% smaller than they read.** `html, body` sets
`font-size: 15px`, not 16, so `min-height: 2.75rem` renders as 41px rather than
the 44 it looks like — under the minimum that Apple's and WCAG's guidance
share. Touch minimums in `globals.css` are therefore written in px. Measuring
the live page with Playwright is what caught it; reading the stylesheet would
not have.

---

## Three faults that looked like one (22 September)

"No AI pairings on the deployed Lost & Found board" turned out to be three
unrelated faults stacked on top of each other. Each alone would have produced a
different symptom; together they read as a single mystery, and the first two
theories in this file were both wrong. Worth reading before diagnosing anything
else on this project.

### 1. Rows inserted around the app never get their AI work done

Match suggestions are written by `createReport` in `app/lost-found-actions.ts`,
at the moment a report is submitted. **An `INSERT` straight into
`LostFoundItem` therefore produces a report that has never been scored**, and
the board correctly shows nothing to pair. The same goes for the photo and the
AI-written title: all three are side effects of going through the app.

The tell was in the timestamps, not the code. Ten reports created inside a
four-second burst (`06:24:01`→`06:24:05`) with `occurredAt` spaced on an exact
seven-hour grid is a script; the one report genuinely filed through the app had
`createdAt` and `occurredAt` equal to the millisecond. **When data looks wrong,
read its timestamps before reading the query** — the shape of the writes
identifies the writer.

`pnpm db:backfill-matches` exists for this. It runs the same matcher over
reports that have no suggestions yet, is a dry run unless given `--write`, only
ever upserts, and skips already-scored reports so a re-run is free. It also
paces its calls: scoring every report back-to-back exhausts Groq's free tier
(8,000 tokens per minute) after a handful, and the first attempt left the board
half-filled. When no model answers it **skips the report and says so** rather
than storing a score nothing produced.

### 2. The deploy pipeline had been dead for a day

Every push after the cab and shuttle work failed to build, so Vercel kept
serving the last good build from 21 September and the site looked frozen. See
the corrected `prisma generate` note under "Two things that only fail in the
cloud" — pnpm 11 had silently stopped running `postinstall`.

**The trap that cost the most time: `vercel ls` lists deployments newest
first, and the three `● Ready` rows at the top were all 23 hours old.** Reading
the status without reading the age said the pipeline was healthy when it had
been broken all day. Always check the age column.

### 3. Migrations are not applied by the build

With the build finally passing, `/admin` returned 500:
`The table public.CabRequest does not exist` (P2021). Vercel builds the code;
**nothing applies migrations to the production database.** They are run by hand
from a developer machine:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.production.local | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
npx prisma migrate deploy
```

`npx prisma migrate status` against the same URL says what is pending. Without
the explicit `DATABASE_URL`, Prisma reads `.env` — which points at **local
Docker** — and the migration silently lands on the wrong database.

So a schema change is two steps, not one: push the code, then deploy the
migration. Only the rider app survives the gap; any page querying a new table
returns 500 until the second step runs.

### Reaching production to diagnose it

`.env.production.local` comes from
`npx vercel env pull --environment=production` after
`vercel link --project isha-sahayata`. It holds a live production database URL,
is gitignored, and is worth deleting when an investigation is over.

Two things to know about that CLI. `vercel link --yes` **creates a new project
named after the directory** rather than linking to the existing one — pass
`--project isha-sahayata` explicitly. And `vercel env pull` cannot retrieve
Secret-type variables (`GROQ_API_KEY` and `ADMIN_PASSCODE` come back as
`[SENSITIVE]`); only Config-type ones such as `DATABASE_URL` arrive intact,
which is enough to query the database while the model key comes from `.env`.

The staff console can be read without a browser: its gate is a cookie whose
value is the passcode itself, so
`curl -H "Cookie: yc_admin_session=<passcode>" .../admin` returns the rendered
page, and the RSC payload inside it shows exactly what the server sent.

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

**It is deployed.** https://isha-sahayata.vercel.app — no password, works
from any network, stays up without the developer's laptop.

- **GitHub:** `github.com/srikanth-karamala/isha-sahayata`, private because
  `ADMIN_PASSCODE` is real. `.env` has never been committed; verified before
  the first push. The branch is `main`, renamed from `master` because that is
  what Vercel deploys from.
- **Vercel** builds on every push to `main`. `isha-sahayata.vercel.app` is a
  production alias pointing at the newest successful build, so the link never
  needs resharing.
- **Prisma Postgres** (via the Vercel integration) rather than the Neon plan
  originally written down — one dashboard instead of two, and it sets
  `DATABASE_URL` itself. `DEPLOY.md` has the operational detail.
- **Photos in the database** rather than an object store, so there is no
  second service and local and deployed behaviour are identical.

Environment variables in Vercel: `DATABASE_URL` (set by the integration),
`ADMIN_PASSCODE`, `GROQ_API_KEY`, and `NEXT_PUBLIC_ONBOARDING_ALWAYS=1` while
demoing.

### Two things that only fail in the cloud

**The Prisma Client must be generated by the build, not only by install.**
Vercel installs into a fresh `node_modules`, so something has to run
`prisma generate` or `next build` fails on the first import of
`@prisma/client`. `postinstall` used to be that something, and on 22 September
it stopped being enough: **pnpm 10 and later do not run dependency build
scripts unless the project names them**, and this project is on pnpm 11, so
`postinstall` was skipped in silence. Nothing warned, because a skipped build
script is not an error — the install simply finished in under a second
(`Done in 987ms using pnpm v11.20.0`) and went straight to the build.

`build` is therefore `prisma generate && next build`. Generating there puts it
where it cannot be skipped, and where a failure to generate stops the deploy
instead of producing a client missing half the schema. Do not reduce this back
to `next build`.

There is also a `pnpm.onlyBuiltDependencies` field in `package.json` naming the
prisma packages. It was added as a belt-and-braces restoration of `postinstall`
and **pnpm 11 ignores it**, warning that the setting moved to
`pnpm-workspace.yaml`. Harmless, currently inert, and worth either moving or
deleting rather than trusting.

**Vercel's default function limit is 10 seconds, and it kills the request
mid-flight** rather than returning an error, so the client sees a promise that
never settles instead of a failure it can report. `app/page.tsx` sets
`maxDuration = 60` for the assistant's sake. Both Groq call sites also carry
`AbortSignal.timeout(45s)`, so a hanging upstream becomes a rejection the UI
can show.

### The tunnel, still useful as a fallback

`ngrok http 3000 --basic-auth isha:<passcode>` in front of `pnpm start` gives
a public link without a deploy. It dies when the laptop sleeps.

**ngrok cannot authenticate on the ashram Wi-Fi.** The network intercepts TLS
and re-signs certificates, and the agent rejects the unknown authority with
`failed to send authentication request: tls: failed to verify certificate`.
It sits alive holding a hostname its cloud has already released, which
surfaces to visitors as `ERR_NGROK_3200`. A hotspot is the fix; restarting on
the same network is not. Installing the proxy certificate would not help —
the agent pins its own trust chain deliberately. The same interception breaks
`curl`, dashboards and other tooling on that network.

### Database notes

Migrations run from a developer machine with `.env` pointed at the cloud
database — which also aims local development at production data, so the local
Docker connection string is kept commented on the line above it in `.env`.

**`prisma/seed-history.ts` deletes lost & found rows and cannot recreate
them.** The demo items were entered by hand through the app, so running that
script destroys them. They were recovered once from the local Docker database;
there is no seed to restore them from.

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

**On a laptop, distances are hidden** and the header says "Tap to locate me on
the campus". Desktop browsers locate by IP address, usually hundreds of
kilometres out, and the app refuses to quote a distance from a fix it does not
believe. On a phone on the campus, real distances appear. See the 441 km trap
above.

**The local database has ten cycles in maintenance and three flat-colour fault
photos.** Put there on 22 September to photograph the repair queue with rows in
it, since production had none. The photos are plain coloured PNGs of a few
hundred bytes — obviously illustrations, not pretend photographs. Local only;
production was never touched. `pnpm db:history` clears them.

**One Ashram Info card says "NOT CHECKED".** That is the design, not a
shortfall — `Daily rituals and offerings` names the rituals but has no clock
times, so there is nothing to vouch for. Three entries are still
`PLACEHOLDER` and not rendered at all.
Filling them needs someone with a notepad at the noticeboards, not a code
change — `lib/ashram-knowledge.ts` says how.

**The introduction may appear on every launch.** That is demo mode:
`NEXT_PUBLIC_ONBOARDING_ALWAYS=1` in `.env`. The screen says so at its foot
when it is on. Remove the variable and rebuild for normal behaviour —
`NEXT_PUBLIC_` values are inlined at build time, so a restart alone will not
do it. Press and hold the app name for about a second to replay the
introduction on any build.

---

## Still open

**Resolved 22 September — the Lost & Found pairings.** See "Three faults that
looked like one" above. The board was never broken; production simply had no
suggestions to show. Backfilled, and three pairings now render live on
production: bottle↔flask 88%, spectacles↔glasses 92%, cable↔cable 95%.

**Still missing on production: the Lost & Found photos.** The items there have
no `Upload` rows at all, so every thumbnail shows the camera-off glyph. Unlike
the pairings this **cannot be regenerated** — a photo is not derivable from a
description. The five that exist live only in the local Docker database and
would have to be copied up, or the demo items re-filed through the deployed app
with their photos attached. Locally all five render.

Worth knowing what that costs: the vision model reads the object as well as the
words, and it is what turned a rider typing "Deposit token" into the stored
title **"Red deposit token, no. 378"**. The number exists only in the image. A
production demo without photos loses the most persuasive thing the feature
does.

**The Overview rework is only half of what was asked.** Cab requests, rides per
day and kilometre milestones can all be built from data that exists. Two
requested items have no data model behind them at all — **customer feedback**
(nothing is collected anywhere) and **achievements** (nothing defines what one
is) — and per this project's honesty rule neither should be rendered with
invented numbers. Either add a feedback capture flow first, or leave those
sections out. E-buggy kilometres are the same: no buggy is tracked, so there is
nothing to total.

**Before this is used for real:**

- **`ADMIN_PASSCODE` must be rotated before this repository is made public.**
  It was left at the example value, and that value appeared in five tracked
  documents — removed from the working tree on 22 September, but present in
  every one of the 83 commits behind it and not removable without rewriting
  all of them.

  **Rotating the live passcode is the fix; scrubbing history is not.** Once
  the deployed value differs, the string in these commits unlocks nothing. A
  history rewrite would destroy the commit record that documents how this app
  was built, to hide a word that no longer works. Set the new value in Vercel
  (`vercel env rm ADMIN_PASSCODE production`, then `vercel env add`) and
  redeploy. The staff console can deploy cycles and close lost-property
  reports, so this is real access, not a formality.
- **The old Groq key wants deleting** at console.groq.com. It was replaced
  after being sent over the intercepted TLS connection during setup; rotating
  only helps once the old one is revoked.
- **Demo mode is on.** Drop `NEXT_PUBLIC_ONBOARDING_ALWAYS` from Vercel or
  every visitor re-reads the introduction on every launch, and will stop
  reading it.

**Longer-term:**

- **Lost & Found claiming is trust-based.** Confirming a reunion closes both
  reports with no verification that the claimant owns the object.
- **Staff access is a shared passcode**, not accounts. Fine for a pilot.
- **Match confidence was tuned against one pair.** More examples would be needed
  to tune it properly; the current prompt may be over-fitted to bottles.
- **The user stories and the full persona list were never received.** The
  message describing them was cut off mid-sentence at "these user stories ca".
  Sahayata is meant to serve several personas — cottage residents and
  poornangas were named; there are others. The introduction's copy and the
  Ashram Info content were written from what the app does, not from who uses
  it, and both would sharpen once the stories arrive.
- **Ride needs its design pass** before any code. Asked for on 21 September:
  a campus map with the e-buggies on it, so a visitor can see which one goes
  where rather than reading route names. The five routes are confirmed in
  `lib/ashram-knowledge.ts` and `MapView` already draws the campus, so this is
  not a new mapping stack — but **none of the shuttle stops have
  coordinates**; only the six cycle stands are surveyed. Two stops named in
  the request, Shivapadam 2 and the cottages at Thennai, are not in the
  confirmed routes. Still undecided: timetable or on-demand, who drives,
  whether a request needs accepting. And a warning — animating buggies along a
  route would read as live tracking, which nobody is doing; a visitor who
  waits at a stop because a moving dot suggested one was coming has been
  misled by the app. `NEXT-SESSION.md` has the full plan.
- **The confirmed ashram facts were vouched for against published
  information, not read off a noticeboard.** Good enough to state plainly, but
  weaker than a board, so re-check anything seasonal. Still genuinely missing:
  the clock times of the daily rituals, accessibility, and the two that move
  (Ekadasi, programmes). `ASHRAM-FACTS-TODO.md` has the detail.
- **22 pre-existing lint problems** (17 errors, 5 warnings) in the rider UI and
  one script, all from before these sessions. Nothing added by them — the count
  was identical before and after. `pnpm lint` to see them.
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

**`.env` points at the local Docker database** (`127.0.0.1:5434`), so `pnpm dev`
reads local data. An earlier revision of this file said it pointed at the
cloud; it does not, and believing otherwise is what made "the same code against
the same database behaves differently" look impossible on 22 September. They
were never the same database. To work against production, set `DATABASE_URL`
explicitly for the one command rather than editing `.env` — see "Three faults
that looked like one".

**The git remote is `github.com/srikanth-karamala/isha-sahayata`**, private.
Pushing to `main` deploys; see the Deployment section above.

---

## The other documents

| File | What it is for |
| --- | --- |
| `README.md` | What the product does and the rider/staff flows. Predates this session; still accurate on the cycles side. |
| `RUNNING.md` | How to start the app day to day, what to do when it will not start, and what the project's disk use is made of. Every command in it was run before being written down. |
| `DEPLOY.md` | What is deployed and how to operate it: the pipeline, the environment variables, the two failures that only happen in the cloud, and what to change before real use. |
| `ASHRAM-FACTS-TODO.md` | The twelve unconfirmed ashram facts, grouped by which desk or noticeboard answers them. Generated from `lib/ashram-knowledge.ts`. |
| `DEMO-DAY.md` | Running a demo off the ngrok tunnel: the link, how to restart it, what to show, and what will look like a bug but is not. |
| `DESIGN.md` | The design system: colour, type, layout, glass, motion and touch targets, with the reasoning behind each. Read before changing how anything looks. |
| `JOURNAL.md` | What happened across 19-21 September, in order: the decisions, the bugs and what each one taught. Read this to understand how the app got here. |
| `NEXT-SESSION.md` | Scope agreed for the introduction and the two new tabs, and what is still needed from Srikanth. |
| `HANDOFF.md` | This file — why things are the way they are, and what is still open. |
