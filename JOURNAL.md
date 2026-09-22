# How this got built — 19 to 21 September 2026

A record of three days' work, written so it can be revisited without the
conversation that produced it. `HANDOFF.md` says why the code is the way it
is; this says what happened, in what order, and what was learned the hard
way.

**64 commits. 59 files changed, 10,311 lines added, 423 removed.**

---

## Where it started

An app called Yellow Cycle: a campus bicycle share for the Isha Yoga Center.
Find a dock on a map, scan a QR code to unlock, ride, drop it at any dock,
report a fault. A staff console at `/admin` for the maintenance queue.

Two services, three bottom tabs, a local Postgres in Docker, and no public
URL.

## Where it ended

**Isha Sahayata** — an in-ashram companion app, deployed at
`isha-sahayata.vercel.app`, with four services, an assistant that answers
from confirmed facts, and a cloud database.

---

# Day one — 19 September

## The rename, and why

The app carried two services by then: cycles, and a lost & found that used a
model to work out whether a lost report and a found report described the same
object. "Yellow Cycle" named one feature out of two. It became **Isha
Sahayata** — *sahayata* means help.

## Lost & Found, and the one load-bearing use of AI

Three places use a model. Two are assists that could be done worse by hand —
fault triage from a photo, and the staff morning briefing. The third could
not exist without one: deciding whether "my black steel water bottle, has a
dent near the bottom" and "dark metal flask, quite scratched, someone left it
on the wall near Biksha" are the same object.

The measured difference:

```
Same lost bottle, same candidates:
  Offline rules  35%  "Same category, 0 matching words in the descriptions."
  Groq           68%  "Both describe a dark metal container (bottle/flask)
                       with surface damage, the timing and material align."
```

A second pair — spectacles against reading glasses — scored 92%, while keys,
a shawl and a phone charger all scored 0%. So the model reads objects rather
than being generous. Below the display threshold a rider would never have
seen the bottle match at all. That is the argument for the feature, and it is
more persuasive than calling the whole app AI-native.

## Staff console work

Several rounds on the staff Lost & Found page: reports were appearing twice,
the lists grew the page instead of scrolling, scrollbars nested inside each
other, and the counts sat apart from the sections they counted. It ended as
one newest-first feed with the counts folded into the headings.

## Groundwork

`RUNNING.md`, `DEPLOY.md` and `HANDOFF.md` were written, the Docker database
was set to restart after a reboot, and the seeded fleet was rebalanced so no
station starts empty.

---

# Day two — 20 September

The long day. 35 commits.

## The morning: the tunnel would not start

The public link was down with `ERR_NGROK_3200`. The first diagnosis was
wrong: the agent process was alive and still claimed to own the hostname, so
it looked like a stale session that a restart would fix.

It would not. The log said:

```
failed to send authentication request: tls: failed to verify certificate:
x509: certificate signed by unknown authority
```

**The ashram network intercepts TLS.** A proxy at `192.168.99.254` re-signs
certificates, and ngrok's agent refuses any certificate that is not ngrok's
own — deliberately, because accepting a re-signed one means accepting that
something can read the tunnel. So the agent could not authenticate, could not
re-register, and sat holding a hostname its cloud had already released.

**A hotspot was the fix, and it was not optional.** This recurred twice more
over the next two days; each time the certificate issuer was the tell.

## Sahayata AI grows up

The assistant became personal and multilingual, learned to read a photo, and
learned to answer with distance and direction — "Spanda Hall, about 250 m
north-east, 3 minutes" rather than just naming a stand.

## The honesty machinery

This is the most distinctive thing in the app, and it was built here.

`lib/ashram-knowledge.ts` is the assistant's entire source of truth for
anything that is not live app data — hand-maintained, not scraped, because a
scraper that silently goes stale is worse than none for questions like "when
does the temple open". Every fact carries a `verified` field:

| State | What happens |
| --- | --- |
| `confirmed` | Stated plainly |
| `unverified` | Shown, with a visible "NOT CHECKED" chip and a caveat |
| `PLACEHOLDER` | Not rendered at all, and never reaches the model |

The three-state version replaced a two-state one, which forced a bad choice:
publish an unchecked timing as fact, or withhold the only answer available
and leave the assistant useless for the questions people actually ask. A
hedged answer is more useful than silence and more honest than a confident
one.

## Onboarding, and the four-tab nav

Feedback arrived: a first-time user landed on a campus map with no idea what
the app was, and the tabs below Cycles were undiscoverable. Two new tabs were
asked for as well — Ride and Ashram Info.

That would have meant five bottom tabs, about 75px each on a phone, with
"Lost & Found" wrapping. The resolution: **four tabs, one per service**, with
reporting a fault folded into Cycles as an action. It keeps its standing as
something reachable without unlocking a cycle first — the reason it was
promoted out of the checkout flow originally — but a fault is always about a
cycle.

An introduction now sits between the splash and the map. Demo mode
(`NEXT_PUBLIC_ONBOARDING_ALWAYS=1`) shows it on every launch, because "once
per device" means it can only be demonstrated on a browser nobody has opened.

## The 441 km bug

The assistant said: *"Biksha Hall is about 441 km south-west of where you are
now (roughly 5,653 minutes walk)."*

The obvious suspicion was the model. It was not. **The same 441 km appeared in
the dock list**, which is computed by `lib/geo.ts` and never goes near a
model — the assistant is handed a pre-built string and repeats it.

The device had reported a position about 450 km away. The distance and bearing
both matched Chennai. A desktop browser, or a phone on Wi-Fi rather than GPS,
reports a city-level location derived from an IP address and is completely
confident about it. Nothing in the app asked whether the position was
plausible before computing from it.

`isPlausibleCampusPosition()` now rejects anything beyond 25 km of the campus,
plus a swapped lat/lng and a 0,0 fix. The radius is generous on purpose: the
campus is about 2 km across, but someone may open the app from Coimbatore or
the airport on the way in.

**The lesson that generalises:** when a number looks absurd, check whether the
same number appears somewhere the model cannot reach. It localises the fault
in one step.

## Two measurement traps

**`rem` touch targets are 7% smaller than they read.** `html, body` sets
`font-size: 15px`, not 16, so `min-height: 2.75rem` renders as 41px rather
than the 44 both Apple's and WCAG's guidance ask for. Touch minimums are
written in px for that reason. Measuring the live page with a browser is what
caught it; reading the stylesheet would not have.

**A fact count was wrong three times.** The ashram knowledge file was
described as holding fifteen facts, then "corrected" to three confirmed, then
corrected again. Parsing the source settled it: **fourteen entries**. A regex
had been double-counting. Lesson: count from the source, not from memory of
counting it before.

## Motion

Tab changes, the dock list and the Info sections all snapped. They now settle
on the existing `--spring` curve, and every animation is disabled under
`prefers-reduced-motion`. A horizontal slide between tabs was deliberately
not added: it would imply the tabs have an order and invite a swipe gesture
that does not exist.

Verified by sampling the live page rather than trusting the CSS — opacity
easing `0 → 0.49 → 0.85 → 1`, the nav pill sliding `66px → 20px`.

## Ashram facts filled in

A table of researched answers arrived, marked as confirmed. They were entered
as `unverified` instead, against those ticks: the source was the official Isha
website, and the file reserves `confirmed` for what someone read on site.
Published pages go stale silently; a noticeboard is corrected the morning a
timing changes, and the board is what the visitor is standing in front of.

Eleven of fourteen facts reached visitors, where two had before. Later, on
being told the material had been vouched for, ten were confirmed outright —
all but `Daily rituals and offerings`, which names the rituals but carries no
clock times, so there was nothing to vouch for.

The dress code was confirmed on the same reasoning as the address: a standing
published policy rather than a timing, and being turned away at a temple
entrance for the wrong clothes is a real cost that hedging would not prevent.

## A developer note reaching visitors

Two banners above the chat log were written for whoever maintains the app and
were being shown to the people using it — naming a source file and
instructing "Staff:" to go and edit it. A visitor cannot act on either
sentence. They now say what a visitor needs, with no file paths.

---

# Day three — 21 September

## A stale page that looked like a bug

A lost-item form failed with "Failed to fetch". The screenshot showed the
**old three-tab nav**, which had stopped existing the day before — the page
had been open in the browser since an earlier build.

Next.js ties server actions to a build ID. When the server is rebuilt
underneath a still-open page, its form submissions point at an action the new
server does not recognise. Reloading was the whole fix. Proven by submitting
the same input through the current build: rows went 10 → 12 and both landed.

## Controls belong where the need arises

The assistant was made to float on every tab, which was right: it answers a
question about whatever is on screen, so it has to follow the reader.

The same treatment was then applied to "Report a broken cycle", and that was
wrong. Reporting is a cycle action. Someone reading ashram timings is not
halfway through a thought about a broken cycle, and a permanent control over
three unrelated tabs costs attention for a case that is rare and already one
tap away. It went back to Cycles only.

The Lost & Found actions were left alone for a related reason: "I lost
something" and "I found something" are that tab's primary content, not
actions that follow you.

## Deploying

The tunnel was never going to be enough — it dies when the laptop sleeps, and
it cannot start on the ashram network at all.

**GitHub:** `github.com/srikanth-karamala/isha-sahayata`, private. `.env` has
never been committed; verified before pushing.

**Vercel + Prisma Postgres**, chosen over a separate Neon account so there was
one dashboard rather than two. The branch was renamed `master` → `main` first,
since Vercel deploys from `main`.

**The database migration.** Four migrations applied cleanly. The seeds were
slower over a network than against local Docker and timed out twice; the core
data landed anyway — 6 hubs, 60 cycles, 15 users, 239 rides, 476 audit
entries.

**A near-miss worth recording:** `prisma/seed-history.ts` *deletes* lost &
found rows but never creates any. Those ten demo items had been entered by
hand through the app, so rerunning the script destroyed them with nothing to
restore from. They were recovered from the local Docker database and copied
across. Anyone running that script again should know.

## The deployment failure

The first deploy failed at build time. **No `postinstall` script ran `prisma
generate`.** Vercel installs into a fresh `node_modules`, so nothing generated
the Prisma Client and `next build` failed on the first import of
`@prisma/client`.

It worked locally only because the client had been generated by the first
install months earlier and had been sitting in `node_modules` ever since —
which is exactly why it surfaced on the first cloud deploy rather than in
development. Reproduced locally by deleting the generated client, confirmed
broken, fixed, confirmed building.

## The assistant hanging in production

The chat sat on a spinner for ever. Not an error being swallowed — the client
has a catch that reports "something went wrong" — a promise that never
settled, so the catch never ran.

Two causes. **Vercel's default function limit is 10 seconds and it kills the
request mid-flight** rather than returning an error, which is precisely the
shape of a promise that never resolves; `maxDuration = 60` gives the model
call room. And **neither Groq call site had a fetch timeout**, so a hanging
upstream was indistinguishable from a slow one; `AbortSignal.timeout(45s)`
turns it into a rejection the UI can report.

It then answered: *"Dinner at the Bhiksha Hall is served in three sittings:
6:50 pm, 7:35 pm, and 8:10 pm"* — plainly, with no caveat, because those
timings are confirmed. Asked about the Dhyanalinga it gives the time and adds
that it has not been checked. The distinction the knowledge file exists to
draw, working end to end.

## Open at the end of day three

**The staff Lost & Found board is not showing its AI pairings on production.**
The data is sound — six match suggestions, scores 70 to 92, none dismissed,
both items in each pair OPEN, and `getOpenFeed` returns all six when queried
directly. The same code against the same database renders three pairings
locally. Production shows none, and only one of four newly attached images.
That points at the running build rather than the code, and needs the Vercel
deployments page to confirm.

---

# Things that look like bugs and are not

- **On a laptop, distances are hidden** and the header offers to locate you.
  Desktop browsers locate by IP, often hundreds of kilometres out, and the app
  refuses to quote a distance it does not believe.
- **One Ashram Info card says "NOT CHECKED"** — the daily rituals, which have
  no clock times recorded yet.
- **Most lost & found cards show a camera-off glyph.** Nine of ten reports
  genuinely have no photo. At thumbnail size the glyph reads as a broken
  image, which is a fair criticism of the glyph rather than a fault.
- **The welcome screen appears on every launch.** That is demo mode.

---

# What is still open

1. **The user stories and the persona list.** The message describing them was
   cut off mid-sentence. Cottage residents and poornangas were named; there
   are others. The introduction's copy and the Info content were written from
   what the app does, not from who uses it.
2. **The Ride tab** is a stub. Asked for on day three: a campus map with the
   e-buggies on it, so a visitor can see which one goes where. The five routes
   are confirmed; none of the shuttle stops have coordinates, and only the six
   cycle stands are surveyed. Two stops named in the request — Shivapadam 2
   and the cottages at Thennai — are not in the confirmed routes. Also flagged:
   animating buggies along a route would read as live tracking, and nobody is
   tracking them.
3. **Three ashram facts remain placeholders**, and the daily ritual times are
   the one real gap. `ASHRAM-FACTS-TODO.md` lists what to ask and where.
4. **`ADMIN_PASSCODE` was left at the example value** on a publicly reachable URL.
5. **The old Groq key** wants deleting at console.groq.com. Rotating only
   helps once the old one is revoked.

---

# The documents

| File | What it is for |
| --- | --- |
| `README.md` | What the product does, and the rider and staff flows. |
| `HANDOFF.md` | Why the code is the way it is, and what is still open. |
| `RUNNING.md` | Starting the app day to day, and what to do when it will not start. |
| `DEPLOY.md` | The original deployment plan. |
| `DEMO-DAY.md` | Running a demo off the ngrok tunnel. |
| `ASHRAM-FACTS-TODO.md` | The unconfirmed facts, grouped by which desk answers them. |
| `NEXT-SESSION.md` | Where work stopped and what to pick up. |
| `JOURNAL.md` | This file — what happened over these three days. |
