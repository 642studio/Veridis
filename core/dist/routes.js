import { getState, addEvent } from "./state.js";
export async function registerRoutes(app) {
    // GET /health — liveness check
    app.get("/health", async () => {
        return { ok: true, service: "veridis-core" };
    });
    // GET /state — devuelve el estado actual
    app.get("/state", async () => {
        return getState();
    });
    // POST /events — recibe evento JSON, lo guarda y actualiza estado
    app.post("/events", async (request, reply) => {
        const event = request.body;
        addEvent(event);
        return reply.status(201).send(getState());
    });
}
