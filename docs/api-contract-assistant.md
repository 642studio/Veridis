# VERIDIS Core ↔ Assistant API Contract

**Contract version:** `1.0`  
**Endpoint:** `POST /assistant/query`  
**Purpose:** Read-only query for external assistants (e.g. Clawbot) to obtain system context. Never mutates state.

---

## Versioning

- Contract versions follow **semver** (`MAJOR.MINOR`).
- **MAJOR:** Breaking changes to request/response shape.
- **MINOR:** Additive changes (new optional fields).
- Clients SHOULD send `Accept: application/vnd.veridis.assistant.v1+json` or include `contract_version` in request to negotiate.

---

## Request

### Method & Path

```
POST /assistant/query
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | `string` | No | Optional natural-language query from the user. Core may use for context; response shape is unchanged. |
| `contract_version` | `string` | No | Desired contract version (e.g. `"1.0"`). If omitted, server returns latest compatible format. |

**Example:**

```json
{
  "query": "What's going on with the system?",
  "contract_version": "1.0"
}
```

**Minimal request (empty body):**

```json
{}
```

---

## Response

### Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Invalid request body |
| `500` | Server error |

### Response Body (200 OK)

| Field | Type | Description |
|-------|------|-------------|
| `contract_version` | `string` | Contract version used for this response (e.g. `"1.0"`). |
| `system_status` | `string` | One of: `"idle"` \| `"processing"` \| `"alert"`. |
| `human_summary` | `string` | Human-readable summary of current system state. |
| `recent_events` | `array` | Simplified list of recent events (see schema below). |
| `suggested_actions` | `array` of `string` | Suggested next actions for the assistant to present or consider. |
| `generated_at` | `string` | ISO 8601 timestamp when the response was generated. |

### `recent_events` Item Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Event identifier. |
| `type` | `string` | Event type. |
| `source` | `string` | Event source. |
| `created_at` | `string` | ISO 8601 timestamp. |

---

## Exact JSON Response Format

```json
{
  "contract_version": "1.0",
  "system_status": "idle",
  "human_summary": "System is idle. No recent activity.",
  "recent_events": [
    {
      "id": "evt_1234567890_1",
      "type": "heartbeat",
      "source": "core",
      "created_at": "2025-02-02T12:00:00.000Z"
    }
  ],
  "suggested_actions": [
    "Check system status",
    "View recent events"
  ],
  "generated_at": "2025-02-02T12:00:05.000Z"
}
```

---

## Field Constraints

- `system_status`: Exactly one of `"idle"`, `"processing"`, `"alert"`.
- `human_summary`: Non-empty string; plain text, no markup.
- `recent_events`: Array (may be empty); order is newest-first.
- `suggested_actions`: Array of non-empty strings; may be empty.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-02 | Initial contract: `system_status`, `human_summary`, `recent_events`, `suggested_actions`. |
