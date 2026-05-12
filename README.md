# Portal

Portal is a lightweight self-hosted browser workspace platform with a React frontend, a Go/Fiber backend, SQLite persistence, and websocket-powered terminal access.

## Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Go, Fiber, WebSockets
- Database: SQLite
- Auth: bcrypt password hashing with signed-in session cookies
- Deployment: Docker Compose

## Project Structure

```text
Portal/
├─ backend/
│  ├─ cmd/portal-api/
│  ├─ internal/
│  │  ├─ auth/
│  │  ├─ config/
│  │  ├─ database/
│  │  ├─ http/
│  │  │  ├─ handlers/
│  │  │  └─ middleware/
│  │  └─ store/
│  └─ Dockerfile
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  └─ lib/
│  └─ Dockerfile
├─ scripts/
├─ data/
├─ workspaces/
├─ docker-compose.yml
└─ .env.example
```

## Features Included

- Login/logout session flow backed by SQLite
- Role-based auth with `admin` and `user` accounts
- Admin bootstrap from environment variables
- REST API for auth, system state, and workspace cards
- Admin-only API for managed user creation
- WebSocket shell endpoint for browser terminal access
- Browser-accessible Chromium workspace session after login
- Separated frontend and backend apps
- Docker Compose setup for self-hosted deployment
- Minimal dark UI inspired by Linear, Vercel, and Tailscale

## Quick Start

1. Copy `.env.example` to `.env`.
2. Set a strong `PORTAL_ADMIN_PASSWORD`.
3. Start with Docker Compose:

```bash
docker compose up --build
```

4. Open `http://localhost:3000`.
5. Log in with the admin email and password from `.env`.
6. Create additional `user` or `admin` accounts from the dashboard. There is no public registration page.

## Local Development

Backend:

```bash
cd backend
go mod tidy
go run ./cmd/portal-api
```

Root dev flow:

```bash
pnpm install
pnpm run dev
```

Frontend only:

```bash
cd frontend
pnpm install
pnpm run dev
```

The Vite dev server proxies `/api` and `/ws` to the backend on `http://localhost:8080`.

Chromium in development is provided by Docker Compose. Start it separately if
you want the embedded browser while using the local Vite/Go dev servers:

```bash
docker compose up chromium
```

This exposes Chromium locally on `https://localhost:3001`, which is what the
Vite dev proxy uses for `/chromium/`.

## Chromium Routing

Portal now separates Chromium's internal upstream from its public browser URL:

- `PORTAL_CHROMIUM_INTERNAL_URL`: where Portal reaches Selkies/Chromium on the
  private network, for example `https://chromium:3001/chromium`
- `PORTAL_CHROMIUM_PUBLIC_URL`: the URL the browser should open in the iframe,
  for example `/chromium/` for same-origin proxying or
  `https://chromium.example.com/chromium` for an external hostname

For same-origin deployments, keep:

```env
PORTAL_CHROMIUM_PUBLIC_URL=/chromium/
```

For separate-hostname deployments behind Cloudflare Tunnel or similar, set:

```env
PORTAL_CHROMIUM_INTERNAL_URL=https://chromium:3001/chromium
PORTAL_CHROMIUM_PUBLIC_URL=https://chromium.example.com/chromium
```

`PORTAL_CHROMIUM_URL` is still accepted as a compatibility fallback, but new
deployments should prefer the explicit internal/public variables above.

## API Overview

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/system/overview`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/workspaces`
- `GET /ws/terminal`

## Notes

- The browser terminal session runs inside the backend container or backend host process.
- The browser surface is a real streamed Chromium session, not an HTML proxy.
- The first admin account is ensured at startup from environment variables.
- Public self-registration is intentionally disabled. New users are created by admins after sign-in.
- The structure is intentionally modular so future app launchers, remote desktop, and Docker orchestration features can be added without reshaping the project.
