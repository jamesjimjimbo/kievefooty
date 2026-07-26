# Kieve Footy

Mobile-first fantasy-style Premier League picks for a private group of friends. This v1 includes a polished demo UI, Supabase-ready auth/data architecture, scripted Competition Weeks, picks, ledger-based scoring, three standings, challenges, admin scaffolding and tested domain rules.

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
5. Add fixtures/odds in the SQL editor or extend the `/admin` mutations.

The browser receives only the publishable key. No service-role key is required by v1. Admin status, deadlines, visibility, challenge uniqueness and ledger access are enforced in Postgres/RLS.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Deployment

Import `jamesjimjimbo/kievefooty` into Vercel, add the Supabase public variables, and set `NEXT_PUBLIC_SITE_URL` to the production origin. The odds and Resend variables are placeholders only and are not required.

## Architecture

- `src/app`: App Router screens
- `src/components`: responsive product UI
- `src/lib/domain`: pure game rules and tests
- `src/lib/supabase`: browser/server clients
- `src/lib/betting`: odds-provider extension point
- `supabase/migrations`: schema, constraints, triggers and RLS
- `docs/GAME_SPEC.md`: canonical game rules

Assumptions: stakes use whole points in normal weeks; Competition Week numbers may be null for breaks; this remains one fixed competition; demo dates/data are illustrative; scheduled auto-picks are represented as an idempotent domain/admin operation but require a future cron runner.
