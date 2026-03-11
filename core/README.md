# VERIDIS Core v0.1

Fastify + TypeScript API server with in-memory state.

## Run

```bash
npm install
npm run dev    # development (tsx watch)
npm run build && npm start   # production
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/state` | Raw system state (`status`, `lastEvent`, `recentEvents`) |
| GET | `/events?limit=50` | Recent events (newest first) |
| GET | `/alerts?limit=50` | Critical events only (newest first) |
| POST | `/events` | Emit an event (updates system state) |

## POST /events payload

`{ type: string, source?: string, level?: "info"|"warning"|"critical", message?: string, payload?: unknown, timestamp?: ISO8601 }`

Status mapping:

- `critical` -> `alert`
- `warning` -> `processing`
- `info` -> `idle`
