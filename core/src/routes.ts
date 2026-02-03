import type { FastifyInstance } from "fastify";
import { getState, addEvent, getEvents, getAlerts } from "./state.js";
import { assistantQuery, type AssistantQueryRequest } from "./services/assistant.js";

export async function registerRoutes(app: FastifyInstance) {
  // GET /health — liveness check
  app.get("/health", async () => {
    return { ok: true, service: "veridis-core" };
  });

  // GET /state — devuelve el estado actual (raw)
  app.get("/state", async () => {
    return getState();
  });

  // GET /events?limit=50 — recent events (newest first)
  app.get("/events", async (request) => {
    const q = request.query as { limit?: string };
    const limit = q?.limit ? parseInt(q.limit, 10) : 50;
    return { ok: true, events: getEvents(Number.isFinite(limit) ? limit : 50) };
  });

  // GET /alerts?limit=50 — critical events only (newest first)
  app.get("/alerts", async (request) => {
    const q = request.query as { limit?: string };
    const limit = q?.limit ? parseInt(q.limit, 10) : 50;
    return { ok: true, alerts: getAlerts(Number.isFinite(limit) ? limit : 50) };
  });

  // POST /assistant/query — structured summary for operators/assistants (read-only)
  app.post<{ Body: AssistantQueryRequest }>("/assistant/query", async (request) => {
    return assistantQuery(getState(), request.body);
  });

  // POST /events — recibe evento JSON, lo guarda y actualiza estado
  app.post<{ Body: unknown }>("/events", async (request, reply) => {
    const event = request.body;
    addEvent(event);
    return reply.status(201).send(getState());
  });
}
