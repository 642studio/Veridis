# Clawbot ↔ VERIDIS Core Integration

How an external conversational agent (Clawbot) should interact with VERIDIS Core. This document is for chat-layer implementers.

---

## Role of the Chat Layer

- **Clawbot** explains system state to the user. It does not decide, store, or mutate.
- **VERIDIS Core** is the single source of truth. It stores events and derives state.

---

## Which Endpoint to Call

**`POST /assistant/query`**

This is the only endpoint Clawbot should use to obtain system context. It returns a structured, human-oriented summary designed for conversational responses.

| Endpoint | Use |
|----------|-----|
| `POST /assistant/query` | ✅ Use — get context for answering the user |
| `GET /state` | ❌ Avoid — raw state; use `/assistant/query` instead |
| `POST /events` | ❌ Never — Clawbot does not emit events |
| `POST /events/simulate` | ❌ Never — testing only; not for agents |

---

## What to Send

```
POST /assistant/query
Content-Type: application/json
```

**Request body:**

| Field | Required | Description |
|-------|----------|-------------|
| `query` | No | The user's natural-language question. Core may use it for context; response shape is unchanged. |
| `contract_version` | No | Desired contract version (e.g. `"1.0"`). Omit to get latest. |

**Example request:**

```json
{
  "query": "What's going on with the system?",
  "contract_version": "1.0"
}
```

**Minimal request (empty body is valid):**

```json
{}
```

---

## What to Never Do

1. **Never mutate state** — Do not call `POST /events` or `POST /events/simulate`. Clawbot is read-only.
2. **Never store events or state** — Do not persist Core data. Fetch fresh context per query.
3. **Never assume you are the source of truth** — Core owns state. Your role is to explain it.
4. **Never bypass the contract** — Use `POST /assistant/query`, not `GET /state`, for chat context.

---

## Example Request and Response

**Request:**

```http
POST /assistant/query HTTP/1.1
Host: localhost:3001
Content-Type: application/json

{
  "query": "Is everything okay?",
  "contract_version": "1.0"
}
```

**Response (200 OK):**

```json
{
  "contract_version": "1.0",
  "system_status": "idle",
  "human_summary": "System is idle. Last event: vision.motion from camera-1.",
  "recent_events": [
    {
      "id": "evt_1738500000000_1",
      "type": "vision.motion",
      "source": "camera-1",
      "created_at": "2025-02-02T14:00:00.000Z"
    }
  ],
  "suggested_actions": [
    "Check system status",
    "View recent events"
  ],
  "generated_at": "2025-02-02T14:00:05.000Z"
}
```

**Response when alert:**

```json
{
  "contract_version": "1.0",
  "system_status": "alert",
  "human_summary": "Alert: Motion detected in restricted area. 1 alert(s) active.",
  "recent_events": [
    {
      "id": "evt_1738500000000_2",
      "type": "alert",
      "source": "camera-1",
      "created_at": "2025-02-02T14:01:00.000Z"
    }
  ],
  "suggested_actions": [
    "Review alerts",
    "Check event details",
    "Acknowledge alert"
  ],
  "generated_at": "2025-02-02T14:01:05.000Z"
}
```

---

## Using the Response

| Field | Use in conversation |
|-------|----------------------|
| `human_summary` | Primary text to present to the user. It is already human-readable. |
| `system_status` | Indicate urgency: `alert` → high, `processing` → in progress, `idle` → normal. |
| `suggested_actions` | Offer these as options or next steps. |
| `recent_events` | Use for follow-up detail (e.g. "The last event was X from Y at Z"). |

---

## Full API Contract

See [api-contract-assistant.md](./api-contract-assistant.md) for the complete request/response schema, versioning, and field constraints.
