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
| POST | `/events` | Emit an event (updates system state) |
| GET | `/state` | Raw system state |
| POST | `/assistant/query` | Structured JSON summary for assistants (read-only) |
| POST | `/events/simulate` | Emit a simulated event (convenience for testing) |

## System State

- `system_status`: `"idle"` \| `"processing"` \| `"alert"`
- `recent_events`: Last 10 events (max)
- `alerts`: Events with `type: "alert"`

## POST /events

Body: `{ type: string, payload?: object, source?: string }`

Events with `type: "alert"` are added to the alerts array and set `system_status` to `"alert"`.

## Simulate events

```bash
# From repo root (Core must be running)
./scripts/simulate-event.sh vision.motion camera-1 medium

# Or via curl
curl -X POST http://localhost:3001/events/simulate \
  -H "Content-Type: application/json" \
  -d '{"type":"vision.motion","source":"camera-1","severity":"medium"}'
```
