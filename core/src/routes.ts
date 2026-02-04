import type { FastifyInstance } from "fastify";
import { getState, addEvent, getEvents, getAlerts } from "./state.js";
import { assistantQuery, type AssistantQueryRequest } from "./services/assistant.js";
import { AuthzService } from "./services/authz.js";

export async function registerRoutes(app: FastifyInstance) {
  const authz = new AuthzService(new URL("../data/authz.json", import.meta.url).pathname);
  await authz.load();

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

  // --- AuthZ (v0) ---
  app.post<{ Body: { telegramUserId: string; name?: string; origin?: string } }>(
    "/auth/onboard",
    async (request) => {
      const user = await authz.onboard(request.body);
      return { ok: true, user };
    }
  );

  app.post<{ Body: { telegramUserId: string; code: string } }>(
    "/auth/redeem",
    async (request, reply) => {
      try {
        const user = await authz.redeemInviteCode(request.body);
        return { ok: true, user };
      } catch (err) {
        return reply.status(400).send({ ok: false, error: String((err as Error).message ?? err) });
      }
    }
  );

  app.post<{ Body: { telegramUserId: string; action: string } }>("/auth/check", async (request) => {
    const result = authz.checkAction(request.body);
    return { ok: true, ...result };
  });

  app.post<{ Body: { telegramUserId: string; ttlHours?: number } }>(
    "/auth/invite/create",
    async (request, reply) => {
      try {
        const invite = await authz.createInviteCode({
          createdByTelegramUserId: request.body.telegramUserId,
          ttlHours: request.body.ttlHours ?? 12,
        });
        return { ok: true, invite };
      } catch (err) {
        return reply.status(403).send({ ok: false, error: String((err as Error).message ?? err) });
      }
    }
  );

  // POST /events — recibe evento JSON, lo guarda y actualiza estado
  app.post<{ Body: unknown }>("/events", async (request, reply) => {
    const event = request.body;
    addEvent(event);
    return reply.status(201).send(getState());
  });
}
