# Deploying Isha Sahayata

Target: a public URL a panel can open from anywhere, on any device.

The app is deployment-ready — photos are stored in Postgres rather than on
disk, so nothing writes to the filesystem at runtime. What remains is a hosted
database, a git remote, and Vercel.

Budget about an hour. Steps 1-3 need your account credentials, so they are
yours to run; steps 4-6 are things I can do once you paste back the connection
string.

---

## 1. Hosted database (Neon)

1. Go to **neon.tech** and sign in with GitHub or Google. The free tier is
   enough.
2. Create a project — name it `isha-sahayata`, region **AWS ap-southeast-1
   (Singapore)** or whichever is closest to Coimbatore.
3. On the project dashboard, copy the **connection string**. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

Paste that back here and I will run the migration and seed it. Do not commit
it anywhere — it goes into `.env` locally and into Vercel's environment
variables.

---

## 2. Git remote

Vercel deploys from a repository. There is no remote configured yet.

1. On **github.com**, create a new repository named `isha-sahayata`.
   **Make it private** — `ADMIN_PASSCODE` is a real passcode.
   Do not add a README, licence or .gitignore; the repo already has them and
   they would conflict.
2. Then, from the project directory:

   ```bash
   git remote add origin git@github.com:<your-username>/isha-sahayata.git
   git branch -M main
   git push -u origin main
   ```

`.env` is gitignored, untracked and has never been committed — verified — so
no secrets go up with it.

---

## 3. Vercel

1. Go to **vercel.com**, sign in with the same GitHub account.
2. **Add New → Project**, and import `isha-sahayata`.
3. Vercel detects Next.js on its own; leave the build settings alone.
4. Before clicking Deploy, open **Environment Variables** and add three:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `ADMIN_PASSCODE` | the same one in your local `.env` |
   | `GROQ_API_KEY` | your Groq key (rotate it first — see below) |

5. Deploy. The first build takes two or three minutes.

---

## 4. Point the local app at Neon and migrate

Once you have the connection string, replace `DATABASE_URL` in `.env` and run:

```bash
pnpm exec prisma migrate deploy      # creates every table
pnpm exec prisma db seed             # the six hubs
pnpm db:history                      # 60 cycles + 21 days of rides
```

Then the lost & found demo data and its AI-scored matches need regenerating
against the new database, since those rows live in Postgres too.

**Keep a copy of the local connection string.** Switching `.env` to Neon points
local development at production data; switch it back when you want the local
database again.

---

## 5. Check it works

On the deployed URL:

- **`/`** — the map loads, hub pins show counts, the bottom nav works
- **`/admin`** — asks for the passcode, then the Overview tab shows the morning
  briefing with a **Groq** badge (not "Offline rules" — if it says that, the
  `GROQ_API_KEY` variable did not take)
- **Lost & Found tab** — the AI-scored pairs appear with their reasoning
- **Report a fault with a photo** — this is the one that would have broken
  before the storage change, so it is worth testing explicitly

---

## 6. Before sharing the link

**Rotate the Groq key.** It was transmitted over an intercepted TLS connection
during setup (see `HANDOFF.md`). Create a new one at console.groq.com, update
it in Vercel's environment variables, and delete the old one.

**Change `ADMIN_PASSCODE`** if the current one is used anywhere else.

---

## Known limits of this deployment

- **Neon's free tier sleeps after inactivity.** The first request after a quiet
  period takes a few seconds to wake the database. Open the link once before a
  demo so it is warm.
- **Groq's free tier allows about 1,000 requests a day.** Far beyond a demo, but
  it is a shared key, so heavy use by several people at once could hit the
  per-minute limit.
- **The map tiles are bundled in the repository** (2.7 MB under `public/tiles`),
  which is fine for Vercel but means the repo is not tiny.
