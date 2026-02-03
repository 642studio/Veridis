import type { SystemState, VeridisEvent, VeridisEventLevel } from "./types.js";

/** Estado inicial del sistema */
const initialState: SystemState = {
  status: "idle",
  lastEvent: null,
  updatedAt: new Date().toISOString(),
};

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
  return { ...state };
}

/**
 * Registra un evento: lo guarda como lastEvent, pone status en "alert" y actualiza updatedAt.
 */
export function addEvent(event: unknown): void {
  const normalized = normalizeEvent(event);
  state = {
    status: "alert",
    lastEvent: normalized,
    updatedAt: normalized.timestamp,
  };
}
