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
- **Ride tab** — a stub, and it reads as one. Still needs its design pass.
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
2. **Ride needs its design pass** before any code: fixed timetable or
   on-demand; who drives; whether a request needs accepting. Comparable in
   size to what Lost & Found took.
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
