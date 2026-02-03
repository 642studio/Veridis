# VERIDIS

Modular, event-driven platform — the digital nervous system of 642 Studio.

## Architecture

- **VERIDIS Core** — Single source of truth. Stores events, exposes state.
- **Assistant** — Explains system state. Does not decide or store.
- **Chat layers** (OpenClaw/Clawbot) — Replaceable consumers of the Core.

## v0.1 Scope

- VERIDIS Core: Node.js + Fastify + PostgreSQL + WebSockets
- Minimal web assistant: Next.js + Tailwind
- No vision, automation, avatar, or hardware

## Quick Start

```bash
# 1. Create DB and run migration
createdb veridis
cd core && npm install && npm run migrate

# 2. Start Core (port 3001)
npm run dev

# 3. In another terminal: start Web (port 3000)
cd ../web && npm install && npm run dev
```

Open http://localhost:3000 for the minimal web assistant.

## API (Core)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/state` | GET | System state summary (for assistants) |
| `/events` | GET | Recent events (`?limit=50`) |
| `/events` | POST | Emit event (`{ type, payload?, source? }`) |
| `/events/simulate` | POST | Simulate event (`{ type, source?, severity?, ... }`) |
| `/ws` | WebSocket | Live event stream |

## Environment

- **Core:** Copy `core/.env.example` to `core/.env`, set `DATABASE_URL`
- **Web:** Optional `NEXT_PUBLIC_CORE_URL` (default: `http://localhost:3001`)
