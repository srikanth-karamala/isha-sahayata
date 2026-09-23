# Where we left off — 20 September 2026

Everything is committed and the tree is clean. The app is running locally and
served publicly through the ngrok tunnel; see `DEMO-DAY.md` for the link and
what to do if it drops.

## Done in this session

- **An introduction on first run** — what Sahayata is, and what it can help
  with. Demo mode is on (`NEXT_PUBLIC_ONBOARDING_ALWAYS=1` in `.env`), so it
  appears on every launch. Remove that line and rebuild for normal behaviour.
- **Four-tab nav** — Cycles, Ride, Lost & Found, Info. Reporting a fault
  became an action rather than a tab.
- **Ashram Info tab**, reading `lib/ashram-knowledge.ts`. Eleven of fourteen
  facts now reach visitors, ten stated plainly.
- **Ride tab** — done on 23 September: the network is drawn as a metro
  diagram. What is left is the running hours, which are `NEVER CHECKED` on
  all seven routes. See "The Ride tab" in `HANDOFF.md`.
- **The 441 km bug** — the app quoted distances from a location hundreds of
  kilometres away. Positions beyond 25 km of the campus are now rejected.
- **Touch targets** — the report button and the Info section switcher were
  under the 44px minimum.
- **Motion** — tab changes, the dock list and the Info sections settle rather
  than snapping, all on the existing spring curve, all disabled under
  `prefers-reduced-motion`.
- **Floating controls** — the assistant and Report now follow the rider across
  every tab, collapsed to a circle and expanding to their name.

## Pick up here

1. **The user stories and the persona list.** The message describing them was
   cut off mid-sentence at "these user stories ca". Cottage residents and
   poornangas were named; there are others. The introduction's copy and the
   Info content were written from what the app does rather than who uses it,
   and both would sharpen once these arrive.
2. **Ride needs its design pass** before any code — see the section below.
   Comparable in size to what Lost & Found took.
3. **The remaining ashram facts** — `ASHRAM-FACTS-TODO.md` lists what is
   missing and which desk answers it. Accessibility is the only real gap; the
   rest are single details (the last bus of the day, shuttle hours, check-in
   times, the clock times of the daily rituals).
4. **Hosting.** Still a tunnel from this laptop. `DEPLOY.md` has the Vercel +
   Neon plan; budget an hour and do it on the hotspot. The static ngrok domain
   is also still unreserved, so the current URL may change on any restart.

## Two things that will look wrong and are not

- On a laptop, distances are hidden and the header offers to locate you.
  Desktop browsers locate by IP, often hundreds of kilometres out.
- One Ashram Info card says "NOT CHECKED" — the daily rituals, which have no
  clock times recorded yet.

## Before this is used for real

- **Rotate the Groq key.** It was sent over the intercepted TLS connection
  during setup. `DEPLOY.md` has the detail.
- **Turn off demo mode**, or every visitor re-reads the introduction on every
  launch.


---

## The Ride tab — what it should be

Asked for on 21 September: **a map of the campus with the e-buggies on it**,
so a visitor can see which buggy goes where rather than reading a list of
route names. The question people actually have is "which one do I take from
Welcome Point to get to Shivapadam", and a timetable answers that badly.

### What we already have

The five routes are confirmed in `lib/ashram-knowledge.ts`:

- Sarpa Vasal → Adiyogi
- Adiyogi → Kalabhairava
- Welcome Point → Nalanda and Brahmaputra
- Welcome Point → Isha Home School
- Welcome Point → Shivapadam 3 and 4

Plus a bullock cart: Sarpa Vasal → Adiyogi, and Welcome Point → the metal
bridge near Bhiksha Hall.

There is also a working map already — `components/MapView.tsx`, MapLibre over
bundled campus tiles, drawing the cycle stands. Routes would be drawn on the
same surface, so this is not a new mapping stack.

### What is missing before it can be drawn

- **Coordinates for each stop.** Only the six cycle stands are surveyed (in
  `prisma/seed.ts`). Sarpa Vasal, Adiyogi, Kalabhairava, Welcome Point,
  Nalanda, Brahmaputra, Isha Home School and the Shivapadams have no
  coordinates anywhere in the project.
- **Two stops named on 21 September that are not in the confirmed routes:**
  **Shivapadam 2** (the file has 3 and 4) and **the cottages at Thennai**.
  Either the published routes are incomplete or these are served by something
  else. Worth asking at the shuttle stand rather than assuming.
- **The hours each route runs**, the fare if any, and whether a buggy can be
  requested or only boarded at a stop. Already flagged in the knowledge file.

### The design questions, restated

The map changes the answers to the three questions from the earlier plan:

1. **Timetable or on-demand?** A map showing routes leans neither way. But
   "simulated" — buggies moving along their routes — implies either real
   tracking (hardware nobody has) or an animation representing the service.
   **An animation that looks like live tracking but is not would be the
   single most damaging thing this feature could do**, on exactly the
   reasoning that governs the ashram facts: a visitor who waits at a stop
   because a moving dot said one was coming has been misled by the app. If
   the buggies are not actually tracked, the map should draw the *routes*
   and say when they run, with nothing that reads as a live position.
2. **Who drives**, and do they need a staff console like `/admin`?
3. **Does a request need accepting?** Only relevant if this is on-demand.

### Suggested build order

1. Collect the stop coordinates — the one genuinely blocking task, and it
   needs someone walking the campus with a phone, not code.
2. Draw the routes statically on the existing map, with stops named and the
   hours beside each. That alone answers "which buggy goes where".
3. Only then consider live positions, and only if the buggies are actually
   tracked.
