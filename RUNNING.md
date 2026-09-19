# Running the app

Every command below was run on this machine and works. Copy them as they are.

---

## The short version

Open a terminal and run these three, in order:

```bash
cd "/home/srikanth.karamala/Downloads/Projects_Portfolio/New_IYC_Cycles/yellow-cycle-app-updated (1)/yellow-cycle-app"

docker start yellow-cycle-postgres

pnpm start -p 3001 -H 0.0.0.0
```

Then open **http://localhost:3001**.

Leave that terminal open — closing it stops the app.

---

## What each step does, and why it matters

### 1. `cd` into the project

The quotes are required. The folder name contains a space and brackets
(`yellow-cycle-app-updated (1)`), and without quotes the shell reads it as three
separate arguments.

### 2. `docker start yellow-cycle-postgres`

The database runs in a Docker container. It is now set to restart by itself
after a reboot, so it will usually already be running — but run this anyway,
because it costs nothing and covers the case where it is not.

If it is already running, the command prints the container name and changes
nothing. Safe to run every time.

Skip it when the container *is* stopped and the app still starts, but every
page returns a 500 error — nothing is listening on port 5434. Verified: with
the container stopped, the rider page returns 500; one `docker start` and it is
back to 200 within a second.

Your data lives in a Docker volume (`yellow_cycle_pg`), so the 60 cycles, 1,549
rides and the lost-and-found reports survive reboots. **You never need to
re-seed unless you want fresh data.**

### 3. `pnpm start -p 3001 -H 0.0.0.0`

Runs the production build: faster than dev mode and no development warnings.

- `-p 3001` — the port. 3000 is not in use by this project.
- `-H 0.0.0.0` — listen on every network interface, so teammates on the same
  Wi-Fi can reach it. Without this it is localhost-only.

---

## Addresses

| What | Where |
| --- | --- |
| Rider app | http://localhost:3001 |
| Staff console | http://localhost:3001/admin |
| From another device | `http://<your-ip>:3001` |

The staff console asks for `ADMIN_PASSCODE`, which is in `.env`.

To find your current IP:

```bash
hostname -I | awk '{print $1}'
```

**That address changes when you switch networks.** If a shared link stops
working, this is usually why — run the command again and share the new one.
Anyone using it must be on the same network as you.

---

## Stopping

- **The app** — press `Ctrl+C` in its terminal.
- **The database** — `docker stop yellow-cycle-postgres`. You can leave it
  running; it uses very little when idle.

---

## When something is wrong

### Every page shows a database error

The container is not running:

```bash
docker start yellow-cycle-postgres
docker exec yellow-cycle-postgres pg_isready -U yellow -d yellow_cycle
```

The second command should print `accepting connections`.

### "Port 3001 is already in use"

An older copy is still running. Find and stop it:

```bash
pkill -f "next start"
```

Then start the app again.

### The AI badges say "Offline rules" instead of "Groq"

The app could not reach the model, and fell back to its deterministic rules.
It is still fully usable — this only affects quality. Check in order:

1. `GROQ_API_KEY` is present in `.env`
2. The server was restarted **after** that key was added — it is read at startup
3. The network is not intercepting HTTPS:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://api.groq.com/openai/v1/models
   ```

   `401` is correct — reachable, asking for a key. `000` means blocked or
   intercepted; switch networks (see `HANDOFF.md`).

### After changing any code

```bash
pnpm build
```

then start again. `pnpm start` serves the last build; it does not pick up edits
on its own.

---

## Working on the code instead of demoing

```bash
pnpm dev --port 3001
```

Reloads on save. Slower, and shows development warnings, so use `pnpm start`
for anything you are showing someone.

---

## Regenerating the data

Only if you want to start clean. **This deletes the current data.**

```bash
pnpm exec prisma migrate deploy   # ensure tables match the schema
pnpm exec prisma db seed          # the six hubs
pnpm db:history                   # 60 cycles + 21 days of rides
```

Note: `pnpm db:history` also clears the lost-and-found reports, because it
deletes the users those reports belong to. Regenerating them and their
AI-scored matches is a manual step — ask Claude, or add the reports through
the app.

---

## If you are setting this up on a different machine

The Docker container does not exist there yet. The project has a
`docker-compose.yml`, but neither `docker compose` nor `docker-compose` is
installed here, so create the container directly:

```bash
docker run -d \
  --name yellow-cycle-postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=yellow \
  -e POSTGRES_PASSWORD=yellow \
  -e POSTGRES_DB=yellow_cycle \
  -p 5434:5432 \
  -v yellow_cycle_pg:/var/lib/postgresql/data \
  postgres:16-alpine
```

`--restart unless-stopped` is worth adding — it means the database comes back
by itself after a reboot, which the current container does not do.

Then:

```bash
pnpm install
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm db:history
pnpm build
pnpm start -p 3001 -H 0.0.0.0
```

You will also need a `.env` with `DATABASE_URL`, `ADMIN_PASSCODE` and
`GROQ_API_KEY`. It is gitignored, so it does not travel with the code.
