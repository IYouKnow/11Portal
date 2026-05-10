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
- Admin bootstrap from environment variables
- REST API for auth, system state, and workspace cards
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

## API Overview

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/system/overview`
- `GET /api/v1/workspaces`
- `GET /ws/terminal`

## Notes

- The browser terminal session runs inside the backend container or backend host process.
- The browser surface is a real streamed Chromium session, not an HTML proxy.
- The first admin account is ensured at startup from environment variables.
- The structure is intentionally modular so future app launchers, remote desktop, and Docker orchestration features can be added without reshaping the project.
