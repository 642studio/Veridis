import type { FastifyInstance } from "fastify";
import { getState, addEvent, getEvents, getAlerts } from "./state.js";

export async function registerRoutes(app: FastifyInstance) {
  // GET /health — liveness check
  app.get("/health", async () => {
    return { ok: true, service: "veridis-core" };
  });

  // GET /state — devuelve el estado actual
  app.get("/state", async () => {
    return getState();
  });

  // GET /events?limit=50 — eventos recientes (newest first)
  app.get("/events", async (request) => {
    const query = request.query as { limit?: string };
    const parsed = query?.limit ? Number.parseInt(query.limit, 10) : 50;
    const limit = Number.isFinite(parsed) ? parsed : 50;
    return { ok: true, events: getEvents(limit) };
  });

  // GET /alerts?limit=50 — eventos critical (newest first)
  app.get("/alerts", async (request) => {
    const query = request.query as { limit?: string };
    const parsed = query?.limit ? Number.parseInt(query.limit, 10) : 50;
    const limit = Number.isFinite(parsed) ? parsed : 50;
    return { ok: true, alerts: getAlerts(limit) };
  });

  // POST /events — recibe evento JSON, lo guarda y actualiza estado
  app.post<{ Body: unknown }>("/events", async (request, reply) => {
    const event = request.body;
    addEvent(event);
    return reply.status(201).send(getState());
  });
}
