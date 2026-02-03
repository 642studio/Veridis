import type { SystemState, VeridisEvent, VeridisEventLevel } from "./types.js";

/** Estado inicial del sistema */
const initialState: SystemState = {
  status: "idle",
  lastEvent: null,
  recentEvents: [],
  updatedAt: new Date().toISOString(),
};

const MAX_EVENTS = 200;

let state: SystemState = { ...initialState };

function normalizeLevel(value: unknown): VeridisEventLevel {
  if (value === "warning" || value === "critical" || value === "info") {
    return value;
  }
  return "info";
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }
  return fallback;
}

function normalizeEvent(input: unknown): VeridisEvent {
  const now = new Date().toISOString();
  if (!input || typeof input !== "object") {
    return {
      type: "unknown",
      source: "unknown",
      level: "info",
      message: "Event received",
      timestamp: now,
    };
  }

  const data = input as Record<string, unknown>;
  const type = typeof data.type === "string" && data.type.trim() ? data.type : "unknown";
  const source =
    typeof data.source === "string" && data.source.trim() ? data.source : "unknown";
  const message =
    typeof data.message === "string" && data.message.trim()
      ? data.message
      : "Event received";
  const level = normalizeLevel(data.level);
  const timestamp = normalizeTimestamp(data.timestamp, now);

  return {
    type,
    source,
    level,
    message,
    payload: data.payload,
    timestamp,
  };
}

/**
 * Devuelve una copia del estado actual.
 */
export function getState(): SystemState {
  return { ...state, recentEvents: [...state.recentEvents] };
}

export function getEvents(limit = 50): VeridisEvent[] {
  const capped = Math.max(1, Math.min(limit, MAX_EVENTS));
  // Return newest-first
  return state.recentEvents.slice(-capped).reverse();
}

export function getAlerts(limit = 50): VeridisEvent[] {
  // v0: treat critical as alert
  return getEvents(limit).filter((e) => e.level === "critical");
}

function statusFromLevel(level?: VeridisEventLevel): SystemState["status"] {
  if (level === "critical") return "alert";
  if (level === "warning") return "processing";
  return "idle";
}

/**
 * Registra un evento: lo guarda como lastEvent, agrega a recentEvents y actualiza estado.
 */
export function addEvent(event: unknown): void {
  const normalized = normalizeEvent(event);

  const nextEvents = [...state.recentEvents, normalized];
  const trimmed = nextEvents.length > MAX_EVENTS ? nextEvents.slice(-MAX_EVENTS) : nextEvents;

  state = {
    status: statusFromLevel(normalized.level),
    lastEvent: normalized,
    recentEvents: trimmed,
    updatedAt: normalized.timestamp,
  };
}
