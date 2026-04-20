# Agent Notes

## Project Snapshot

- Single Next.js 16 App Router app (no monorepo/workspaces).
- Core domains: auth (`next-auth` + credentials), route planning (MapLibre + ORS), persistence (Postgres + Drizzle).

## Commands That Matter

- Install deps: `pnpm install`
- Dev server: `pnpm dev` (uses Turbopack)
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Production build check: `pnpm build`
- Drizzle generate migration: `pnpm db:generate`
- Apply migrations: `pnpm db:migrate`
- Open DB studio: `pnpm db:studio`

## Required Environment

- Copy `.env.example` -> `.env.local`.
- Required vars for real app behavior: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `ORS_API_KEY`.
- `drizzle.config.ts` loads `.env.local` explicitly via `dotenv`.

## Auth / Session Gotcha

- Credentials login in this repo requires JWT session strategy (`lib/auth.ts` uses `session.strategy = "jwt"`).
- Do not switch to `"database"` strategy unless you rework credentials flow; it causes `CALLBACK_CREDENTIALS_JWT_ERROR`.

## DB + Migrations

- Drizzle schema lives in `lib/db/schema.ts`; generated SQL and metadata live in `drizzle/`.
- After schema changes, run `pnpm db:generate` and commit both SQL and `drizzle/meta/*`.

## API + UI Wiring

- API entrypoints are in `app/api/**/route.ts`.
- Planner page is server-rendered in `app/planner/page.tsx` and passes serialized data to `components/planner/planner-client.tsx`.
- ORS calls are server-side only in `app/api/routes/generate/route.ts` (keep API key out of client).

## Product Rules Encoded in Code

- Max waypoints is hard-limited to 25 via `MAX_WAYPOINTS` (`lib/constants.ts`) and zod validation (`lib/validation.ts`).
- Round-trip mode auto-closes to first point via `getCoordinatesForRoute` (`lib/routes.ts`).

## Styling / Map Integration

- MapLibre CSS is imported globally in `app/globals.css`; do not remove unless you replace map stack.
- Session + theme providers are wrapped in `components/providers.tsx` and mounted in `app/layout.tsx`.

## Repo Hygiene

- There is no test suite yet; standard verification is: `pnpm typecheck && pnpm lint && pnpm build`.
- Avoid committing local tool artifacts such as `.playwright-mcp/`, `.mcp.json`, and machine-local config noise.
