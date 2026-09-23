# Deployment — Isha Sahayata

**It is deployed.** https://isha-sahayata.vercel.app — no password, reachable
from any network, and it stays up without anyone's laptop.

This file described how to get there. It now records what was actually built
and how to operate it. For the story of the day it took, see `JOURNAL.md`.

---

## What is running

| Piece | Where |
| --- | --- |
| Code | `github.com/srikanth-karamala/isha-sahayata`, private, branch `main` |
| Hosting | Vercel, project `isha-sahayata` |
| Database | Prisma Postgres, via the Vercel integration |
| Model | Groq, key in Vercel's environment variables |
| Photos | In Postgres, served by `/api/uploads/[id]` |

`isha-sahayata.vercel.app` is a **production alias**: it always points at the
newest successful build of `main`, so the link never needs resharing.

Two longer URLs also work — `isha-sahayata-srikanth-karamala.vercel.app` and
the `-git-main-` variant. Same deployment; prefer the short one.


## A deploy is two steps, not one

Pushing to `main` builds and serves the **code**. It does not touch the
**database**. Getting this wrong cost a full day on 22 September, when the site
looked frozen for a week and then returned 500 once it unfroze.

- **Code** → `git push origin main`. Vercel builds and the alias follows.
- **Schema** → `npx prisma migrate deploy`, run by hand against production.
- **Data** → the seed for whatever it is (`db:shuttles`, `db:shuttle-coords`),
  also by hand.

Both of the manual steps need `DATABASE_URL` set for that one command:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.production.local \
  | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
npx prisma migrate status     # what is pending
npx prisma migrate deploy     # apply it
```

Without the export, Prisma reads `.env` — which points at **local Docker** —
and the migration silently lands on the wrong database.

Only the rider app survives the gap between the two steps. Any page querying a
table that does not exist yet returns 500; `/admin` did exactly that, with
`The table public.CabRequest does not exist` (P2021), while the home page
stayed fine.

### Reading a failed deploy

`vercel ls --prod` lists newest first **with an age column, and the age is the
point**. Three `● Ready` rows at the top looked healthy and were all 23 hours
old, which is what hid a week of failing builds. Check the age before the
status.

`vercel inspect --logs <url>` gives the actual build error. And two CLI traps:
`vercel link --yes` creates a *new* project named after the directory rather
than linking to the existing one, so pass `--project isha-sahayata`; and
`vercel env pull` cannot retrieve Secret-type variables, so `GROQ_API_KEY` and
`ADMIN_PASSCODE` come back as `[SENSITIVE]` while `DATABASE_URL` arrives
intact.

## How a change reaches the site

```
edit → git commit → git push origin main
                          ↓
              GitHub notifies Vercel
                          ↓
      build: pnpm install → prisma generate → next build   (~2 min)
                          ↓
                 live at the alias
```

**Pushing is what deploys. You do not redeploy by hand after a push.** There
is no separate step and no button to press — Vercel watches `main` and builds
on every push to it. Wait about two minutes and reload.

To check whether a change has landed, open the Vercel **Deployments** tab:
the newest entry should carry your commit message and be marked **Ready**.

### When you *do* press Redeploy

Only two cases:

1. **After editing an environment variable.** Those reach a build, not a
   running site, so saving a key changes nothing until something rebuilds.
   Untick "use existing build cache" when you do.
2. **After a failed build**, to retry without making a new commit.

Neither happens in ordinary work. If a change is not showing and neither of
these applies, the build failed or is queued — check the Deployments tab
rather than pushing again.

Two things that do *not* work this way:

- **Database content is not code.** Rows — lost & found reports, cycles,
  confirmed facts written through the app — change the site immediately with
  no deploy. But `lib/ashram-knowledge.ts` *is* code, so confirming a timing
  there does need a push.
- **Environment variables need a rebuild.** Changing `GROQ_API_KEY` or
  `ADMIN_PASSCODE` in Vercel does nothing to the running site until the next
  build. Redeploy after editing one, and untick "use existing build cache".

## Environment variables

| Name | Set by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | the Prisma integration | Do not edit by hand |
| `ADMIN_PASSCODE` | you | Set your own. Never the example value — see below |
| `GROQ_API_KEY` | you | Rotated 21 September |
| `NEXT_PUBLIC_ONBOARDING_ALWAYS` | you | `1` while demoing; remove for real use |

The Prisma integration also sets `POSTGRES_URL` and `PRISMA_DATABASE_URL`.
Neither is used — the schema reads `DATABASE_URL`.

Values are pasted raw. **No quotes**: `"gsk_..."` makes the quote marks part
of the key.

## Two things that only fail in the cloud

Both cost an afternoon on 21 September, and both are invisible locally.

**`postinstall: prisma generate` in `package.json` is load-bearing.** Vercel
installs into a fresh `node_modules`, so without it nothing generates the
Prisma Client and `next build` fails on the first import of `@prisma/client`.
It works locally only because the client was generated by an install months
ago and has been sitting there since. Do not remove it.

**Vercel's default function limit is 10 seconds, and it kills the request
mid-flight** rather than returning an error — so the browser sees a promise
that never settles rather than a failure it can report. `app/page.tsx` sets
`maxDuration = 60` for the assistant's sake, and both Groq call sites carry
`AbortSignal.timeout(45_000)` so a hanging upstream becomes a visible
rejection.

## The database

Migrations and seeds run from a developer machine with `.env` pointed at the
cloud database:

```bash
pnpm exec prisma migrate deploy   # applies the four migrations
pnpm exec prisma db seed          # the six hubs and the fleet
pnpm db:history                   # riders, rides and audit history
```

`pnpm db:history` writes thousands of rows one at a time. Against local Docker
that is quick; over a network it takes several minutes and will look like it
has hung. Let it finish.

**`prisma/seed-history.ts` deletes lost & found rows and cannot recreate
them.** The demo items — including the bottle/flask and spectacles/glasses
pairs that demonstrate the matching — were entered by hand through the app.
Running that script destroys them, and there is no seed to restore from. They
were recovered once by copying from the local Docker database.

Pointing `.env` at the cloud database also aims local development at
production data. The local Docker connection string is kept commented on the
line above it, so switching back is one edit.

## Checking a deployment

On the live URL:

- **`/`** — the map loads, stands show counts, all four tabs work
- **Ask Sahayata AI** — ask "when is dinner served?". It should answer plainly
  (those timings are confirmed). The header should read "Answered by Groq"; if
  the reply is "something went wrong reaching me", the key is not reaching the
  deployment
- **Info → Timings** — populated, with one "NOT CHECKED" chip on the daily
  rituals
- **`/admin`** — asks for the passcode, then the briefing should carry a
  **Groq** badge rather than "Offline rules"
- **Report a fault with a photo** — the path that would have broken before
  photos moved into the database

## Before this is used for real

- **Change `ADMIN_PASSCODE`.** The staff console is on a publicly reachable URL,
  and the staff console can deploy cycles and close lost-property reports.
- **Delete the old Groq key** at console.groq.com. It was replaced after being
  sent over the ashram network's intercepted TLS connection; rotating only
  helps once the old one is revoked.
- **Remove `NEXT_PUBLIC_ONBOARDING_ALWAYS`**, or every visitor re-reads the
  introduction on every launch and will stop reading it.

## Known limits

- **No authentication on the rider app.** Anyone with the link can use it, and
  can find `/admin`, which only the passcode protects.
- **Groq's free tier** allows roughly a thousand requests a day on a shared
  key — ample for a pilot, but several people at once could hit the
  per-minute limit.
- **The map tiles are in the repository** (2.7 MB under `public/tiles`), which
  Vercel serves happily but keeps the repo from being small.

## The road not taken

The original plan used **Neon** for Postgres. Prisma Postgres was chosen
instead because it is created from inside the Vercel dashboard and sets
`DATABASE_URL` itself — one account and one dashboard rather than two, which
mattered more than any difference between the two databases. Either would
work; the schema is ordinary Postgres.

## Alternative: the ngrok tunnel

Still useful for showing work in progress without deploying. See
`DEMO-DAY.md`. It dies when the laptop sleeps, and **it cannot start on the
ashram Wi-Fi at all** — that network intercepts TLS, and ngrok's agent
deliberately refuses a re-signed certificate. A hotspot is the only fix;
installing the proxy certificate does not help.
