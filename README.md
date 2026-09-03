# Kieve Footy

Mobile-first fantasy-style Premier League picks for a private group of friends. This v1 includes a polished responsive UI, Supabase auth/data architecture, scripted Competition Weeks, live picks, ledger-based scoring, three standings, post-lock league pick visibility, challenges, weekly admin game configuration and tested domain rules.

## Local setup

Requirements: Node 20+ and pnpm.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Protected pages require a confirmed Supabase account.

## Supabase setup

1. Create a Supabase project and copy its project URL and anon key into `.env.local`.
2. Link the Supabase CLI, then run `supabase db push`.
3. Run `supabase db seed`, or paste `supabase/seed.sql` in the SQL editor.
4. Create the first user through `/auth/sign-up`; the database trigger creates its profile automatically. Then set `is_admin = true` for that profile in the Supabase Table Editor.
5. Add fixtures/odds in the SQL editor. Use `/admin` to mark eligible fixtures, select the Game of the Week, and synchronize the lock to the first kickoff.

The browser receives only the publishable key. Automatic result checks use `SUPABASE_SERVICE_ROLE_KEY` exclusively in the protected server cron route; it must never use a `NEXT_PUBLIC_` prefix. Admin status, deadlines, visibility, challenge uniqueness and ledger access are enforced in Postgres/RLS.

Weekly results are fetched from football-data.org through the scheduled Vercel cron route at `/api/cron/results`. The same run adds clearly labelled default picks for members who missed the deadline. Set `FOOTBALL_DATA_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` in Vercel. Both auto-picking and settlement are idempotent: corrected scores rebuild weekly wager entries, challenge transfers, and Game-of-the-Week streak bonuses without duplicating points. Admins can also run **Check now** or save a corrected final score from the Admin desk.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Deployment

Import `jamesjimjimbo/kievefooty` into Vercel, add the Supabase public variables, and set `NEXT_PUBLIC_SITE_URL` to the production origin. Add `FOOTBALL_DATA_API_KEY` to enable the admin’s current-table forecast refresh. The odds and Resend variables are placeholders only and are not required.

## Architecture

- `src/app`: App Router screens
- `src/components`: responsive product UI
- `src/lib/domain`: pure game rules and tests
- `src/lib/supabase`: browser/server clients
- `src/lib/betting`: odds-provider extension point
- `supabase/migrations`: schema, constraints, triggers and RLS
- `docs/GAME_SPEC.md`: canonical game rules

Assumptions: stakes use whole points in normal weeks; Competition Week numbers may be null for breaks; this remains one fixed competition; demo dates/data are illustrative.
