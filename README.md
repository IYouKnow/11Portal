# Portal

Portal is a self-hosted browser workspace platform with a React frontend, a Go/Fiber backend, SQLite persistence, browser terminals, embedded Chromium, and now native-feeling Remote Desktop sessions backed by Apache Guacamole.

## Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Go, Fiber, WebSockets
- Portal database: SQLite
- Remote desktop gateway: Apache Guacamole + guacd + PostgreSQL
- Auth: bcrypt password hashing with signed-in session cookies
- Deployment: Docker Compose

## Quick Start

1. Copy `.env.example` to `.env`.
2. Set strong values for `PORTAL_ADMIN_PASSWORD`, `PORTAL_GUACAMOLE_ADMIN_PASSWORD`, and `GUACAMOLE_POSTGRES_PASSWORD`.
3. Start everything:

```bash
docker compose up --build
```

4. Open `http://localhost:38480`.
5. Log in with the Portal admin email and password from `.env`.

Portal remains the only public entrypoint. Guacamole, `guacd`, PostgreSQL, and Windows RDP targets stay private on the internal Docker network.

## Local Development

Backend:

```bash
cd backend
go run ./cmd/portal-api
```

Frontend:

```bash
cd frontend
pnpm install
pnpm run dev
```

The Vite dev server proxies `/api` and `/ws` to `http://localhost:8080`. Chromium is still easiest to run through Docker Compose:

```bash
docker compose up chromium
```

## Chromium Routing

Portal separates Chromium's internal upstream from the browser-facing URL:

- `PORTAL_CHROMIUM_INTERNAL_URL`: where Portal reaches Chromium on the private network
- `PORTAL_CHROMIUM_PUBLIC_URL`: the URL the frontend should open, usually `/chromium/`

For same-origin deployments, keep:

```env
PORTAL_CHROMIUM_PUBLIC_URL=/chromium/
```

## Remote Desktop Architecture

Portal owns the user experience. Guacamole is used only as the internal HTML5 RDP client and gateway.

Flow:

1. User signs in to Portal.
2. User opens the `Remote Desktop` app.
3. User selects or creates a Windows profile.
4. User enters session credentials.
5. Portal backend creates or updates the matching Guacamole RDP connection.
6. Portal proxies Guacamole under `/guacamole/*` after Portal auth succeeds.
7. The RDP session opens inside the Portal window.

Important details:

- Portal auth is required for all Remote Desktop API routes.
- Portal auth is required before proxying `/guacamole/*`.
- Guacamole admin credentials are never exposed to the frontend.
- `guacd` is not exposed publicly.
- Windows RDP is not exposed publicly.
- RDP passwords are not stored in Portal.
- Portal stores the profile. Guacamole stores a connection that uses `${GUAC_PASSWORD}` so the session password entered at connect time is not written into the saved connection parameters.

## Remote Desktop Configuration

These environment variables drive the integration:

```env
PORTAL_GUACAMOLE_INTERNAL_URL=http://guacamole:8080/guacamole
PORTAL_GUACAMOLE_ADMIN_USERNAME=portaladmin
PORTAL_GUACAMOLE_ADMIN_PASSWORD=change-me-guacadmin
PORTAL_GUACAMOLE_DATA_SOURCE=postgresql
```

The bundled `docker-compose.yml` adds:

- `guacamole`
- `guacd`
- `guacamole-db` (PostgreSQL)

The PostgreSQL schema is initialized from [`docker/guacamole/init/001-initdb.sql`](docker/guacamole/init/001-initdb.sql).

## Remote Desktop Profile Shape

Portal profiles now include:

- `name`
- `host`
- `port` with default `3389`
- `domain` optional
- `username` optional
- `ignoreCert` boolean

At connect time, the frontend sends:

- `profileId`
- `username`
- `password`

The backend responds with a Portal-local Guacamole launch URL that the frontend embeds in an iframe.

## API Overview

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/system/overview`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/workspaces`
- `GET /api/v1/remote-desktop/profiles`
- `POST /api/v1/remote-desktop/profiles`
- `DELETE /api/v1/remote-desktop/profiles/:id`
- `POST /api/v1/remote-desktop/launch`
- `GET /ws/terminal`

## Notes

- The backend will bootstrap the configured Guacamole admin user from the default `guacadmin` account if needed on first startup.
- If you already changed the default Guacamole admin credentials manually, set `PORTAL_GUACAMOLE_ADMIN_USERNAME` and `PORTAL_GUACAMOLE_ADMIN_PASSWORD` to those values.
- The Portal database and the Guacamole database are separate on purpose.
