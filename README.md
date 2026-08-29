# Yellow Cycle

Campus bike-share for **Isha Yoga Center** (Velliangiri foothills). Yellow Cycle is the branded shared bicycle: find a dock, unlock by QR, ride between halls, return, report a fault. Staff use `/admin` for maintenance.

This is **not** a city micromobility / routing product. The bike is the token; docks are inventory.

---

## Product approach

We optimized for three ashram jobs:

1. **Find a bike fast** — map-first home, docks with stock sorted near the rider, header shows ready count **near you** (not campus total).
2. **Return without confusion** — while riding, a **slide-to-drop-off** control arms when GPS is within ~75 m of an open dock; swipe confirms. No fake “start/end ride” tabs.
3. **Staff fix what broke** — bikes enter the queue via **Report fault** (notes + optional photo), not via a normal drop-off. Mechanics must upload a **repair photo** before marking the cycle available again.

### Rider flow

```
Identity (name + phone, once)
  → Map + nearby docks
  → Scan QR on the frame
  → Unlock if AVAILABLE
  → Ride (GPS track)
  → Near dock → slide to drop off
     or report fault (optional photo) → staff queue
```

### Staff flow

```
/admin + passcode
  → Maintenance list (MAINTENANCE cycles)
  → See notes / fault photo / last hub
  → Choose deploy dock + upload repair photo
  → Cycle returns to AVAILABLE
```

### Design language

Aligned with Isha volunteering surfaces: Fedra / Mukta typography hierarchy, quiet cream chrome, yellow as the only product accent. Map pins show available count; faulted docks use a red ring.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | **Next.js 16** (App Router) + **React 19** | Server Actions for checkout / drop-off / fault / repair; phone-shell UI |
| Styling | **Tailwind CSS v4** + `app/globals.css` | Utility layout + Isha tokens (`--primary`, `--paper`, Fedra classes) |
| Data | **Prisma 5** + **SQLite** | Simple local inventory (`Hub`, `Cycle`, `Ride`, `User`, `AuditLog`) |
| Map | **MapLibre GL 6** | Pitched campus view, markers, offline raster tiles |
| Basemap | Local Esri World Imagery tiles under `public/tiles/isha/` | Avoids flaky remote tile SSL in this environment; regen via `scripts/download-campus-tiles.mjs` |
| Scan | **html5-qrcode** | Camera QR → cycle lookup |
| Icons | **lucide-react** | Lightweight UI glyphs |
| Package manager | **pnpm** | Locked via `packageManager` in `package.json` |

### Notable modules

- `app/actions.ts` — cycle state machine (`AVAILABLE` / `IN_USE` / `MAINTENANCE`), one active ride per user, capacity checks, GPS ride pings
- `components/MapView.tsx` — MapLibre map, pins, 2D/3D pitch toggle, locate / zoom
- `components/MainDashboard.tsx` — map-first rider shell, near-you list, slide drop-off while riding
- `components/SlideToConfirm.tsx` — geofence-armed horizontal confirm
- `components/ActionModal.tsx` — state-aware scan result (unlock / return / fault)
- `app/admin/` — passcode gate (`ADMIN_PASSCODE`), live rides, repair-with-photo
- `lib/geo.ts` — haversine, near-you sort, `DROP_OFF_RADIUS_M`
- `lib/map-style.ts` — local tile style, sky/ground fill for pitched zoom-out
- `prisma/seed.ts` — hub coordinates from OpenStreetMap campus landmarks

---

## Run locally

```bash
pnpm install
pnpm exec prisma db push
pnpm exec prisma db seed
pnpm dev
```

- Rider app: [http://localhost:3000](http://localhost:3000) (or the port Next prints; this machine often uses **3001** if 3000 is taken)
- Staff: `/admin` — passcode from `.env` → `ADMIN_PASSCODE` (default in local `.env`: `yellow123`)
- Sample QR codes from seed: `ISHA-CYC-101` … `ISHA-CYC-106` (`ISHA-CYC-103` starts in `MAINTENANCE`)

Copy `.env` keys as needed:

```env
DATABASE_URL="file:./dev.db"
ADMIN_PASSCODE="yellow123"
```

Regenerate campus satellite tiles (optional):

```bash
node scripts/download-campus-tiles.mjs
```

---

## Data model (short)

- **Hub** — named dock with lat/lng + capacity  
- **Cycle** — QR, status, current hub, optional fault/repair photo URLs  
- **Ride** — active path / distance while checked out  
- **User** — rider name + phone  
- **AuditLog** — CHECKOUT / DROP_OFF / REPORT_FAULT / REPAIRED  

Uploads land in `public/uploads/{faults,repairs}/` (gitignored).

---

## What we deliberately did not build

- City-scale payments, reservations, or turn-by-turn routing  
- Photoreal 3D meshes (pitch + local imagery is enough for campus orientation)  
- Treating every drop-off as a fault (only explicit reports enter the staff queue)
