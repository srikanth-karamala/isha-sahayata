# Next session

**Status: the 20 September scope below is BUILT** — the introduction, the
Ashram Info tab, the Ride stub and the four-tab nav all shipped that day. What
remains is listed under "Still needed" and "Ride" below. Kept for the reasoning
behind each decision; `HANDOFF.md` is the fuller record.

Feedback received: onboarding screen, plus two new nav tabs (Ride, Ashram Info).
Sahayata is an in-ashram app serving multiple personas (cottage residents,
poornangas, others TBC).

## Still needed from Srikanth

- **The user stories** — message was cut off mid-sentence. These drive the
  onboarding copy and the Ashram Info content. Structure does not depend on
  them; only wording does, so build can start without.
- **Full persona list** — cottage people and poornangas named so far.

## 1. Onboarding screen — DONE

Gap: first run is Splash → IdentityGate (name + phone) → map. Nothing explains
what Sahayata is. A first-time user lands on a map with no context.

Insert an explainer between splash and the identity gate: what Sahayata is,
and what it can help with (one line per service).

**Open recommendation:** resist a persona picker at first run unless the user
stories show the flows genuinely diverge. It adds a decision before anyone sees
value, people pick wrong, and it then needs a way to change later. Default to
showing everyone everything and letting tabs sort it out. Decide once the
stories arrive.

## 2. Ride tab — STUB SHIPPED, service still to design

Confirmed as a genuinely new service, NOT a rename of Cycles and not a split of
the existing ride flow. Buggy/shuttle timings, or requesting a lift across
campus.

Biggest item of the three — needs its own data model (vehicles, routes or
stops, timings, requests). Cycles tab stays exactly as it is.

Design questions still open: fixed-route timetable vs. on-demand request? Who
drives, and do they need a staff-side console like /admin? Does a request need
accept/assign, or is it informational only?

## 3. Ashram Info tab — DONE (content still thin)

All four shipped:
- Timings (darshan, meals, temple, facilities)
- Places & directions (halls, dining, medical, the address)
- Contacts & helpdesk (medical, security, cottage support, lost property)
- Guidelines & FAQs (dress code, conduct, newcomer questions)

Done: the Info tab reads `lib/ashram-knowledge.ts` directly, so it never
duplicates the facts. Twelve of the fifteen entries there are still
PLACEHOLDER and need confirming on site; see `ASHRAM-FACTS-TODO.md`.

## Build order — followed

Onboarding → Ashram Info → Ride stub. All three shipped 20 September, plus the
nav restructure, a touch-target fix on the report button, and the location
sanity check that stopped the app quoting 441 km distances.

## Housekeeping

- Static ngrok domain still unreserved. Needs Srikanth in the dashboard, or an
  API key. Current URL is random and may change on any restart.
- Vercel deployment started and deliberately paused: three accounts the night
  before a demo was the wrong trade. `DEPLOY.md` has the plan; nothing done.
- ngrok cannot authenticate on ashram Wi-Fi (TLS interception re-signs certs).
  Tunnel work requires the hotspot.
