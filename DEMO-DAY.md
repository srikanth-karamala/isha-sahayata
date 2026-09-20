# Demo day — quick reference

## The link

**https://slurp-sandy-chitchat.ngrok-free.dev**
Username `isha` · Password `29bs4sjidz`

## Three rules while demoing

1. **Stay on the hotspot.** ngrok cannot authenticate on the ashram Wi-Fi —
   the network re-signs TLS certificates and ngrok rejects the unknown
   authority. Rejoining ashram Wi-Fi kills the tunnel and it will not restart
   until you are back on the hotspot.
2. **Keep the laptop awake.** The tunnel is this laptop holding a connection
   open to ngrok's cloud. If it sleeps, the link dies.
3. **Open the link once before you start**, so the first visitor is not the
   one waiting for it to warm up.

## If the link stops working

Symptom: `ERR_NGROK_3200`, "endpoint is offline".

```bash
pkill -f "ngrok http"
ngrok http 3000 --basic-auth isha:29bs4sjidz --log=stdout
```

The URL will probably change, because no static domain is reserved. The new
one is printed in the output. If it fails with a certificate error, you are on
ashram Wi-Fi — switch to the hotspot.

If the app itself is down (the tunnel works but shows an error):

```bash
pnpm start -p 3000 -H 0.0.0.0
```

## What to show

The flow that demonstrates the most in the least time:

1. **Welcome screen** — it appears on every launch (demo mode is on), so you
   can show it repeatedly without clearing anything.
2. **Cycles tab** — the live campus map, stands with real counts, distances.
3. **Info tab → Timings** — point at the "NOT CHECKED" chip. The app declines
   to state a timing nobody has confirmed. This is worth saying out loud: it
   is the hard part, and it is easy to miss.
4. **Ask Sahayata AI** — ask "where can I find a cycle?" It answers from live
   data, not from training.
5. **Lost & Found** — the AI matching is the one feature here that could not
   be built without a model.

## Two things that will look odd, and are not bugs

- **On a laptop, distances are hidden** and the app says "Tap to locate me on
  the campus". Desktop browsers locate by IP address, often hundreds of
  kilometres out, so the app refuses to quote a distance it cannot trust.
  On a phone on campus, real distances appear.
- **One Ashram Info card carries a "NOT CHECKED" chip** — the daily rituals,
  which have no clock times recorded yet. Worth pointing at during a demo: the
  app distinguishes what it can vouch for from what it cannot, and says so.

## Known gaps, if asked

- **Ride tab** is a stub. The shuttle service needs its own data model and
  three product decisions: timetable or on-demand, who drives, whether a
  request needs accepting.
- **Ashram Info** is thin until someone walks the campus and confirms the
  timings. No code needed for that — it is `lib/ashram-knowledge.ts`.
- **Hosting** is a tunnel from this laptop. `DEPLOY.md` has the Vercel + Neon
  plan for a permanent URL; budget an hour, and do it on the hotspot.
