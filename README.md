# Bike Tour Planner

This app lets you register with email/password, plan bike routes by clicking waypoints on a map, and save tours to Postgres.

## Stack

- Next.js 16 App Router
- Postgres + Drizzle ORM
- NextAuth credentials authentication (session cookies)
- MapLibre map rendering
- OpenRouteService route generation (`cycling-regular`)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Required variables:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `ORS_API_KEY`

## Local Setup

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`.

## Features

- Email/password registration and login
- Protected planner page (`/planner`)
- Waypoint map interaction with max 25 points
- Route modes: open and round-trip (auto-close)
- Route display with distance and estimated duration
- Save, load, and delete tours

## Kubernetes Deployment Note

- `deployment/route-planner.yaml` uses `imagePullPolicy: Always` for `jhell/route-planner:latest`, so each pod start pulls the latest pushed image.
