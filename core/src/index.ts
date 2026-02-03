import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes.js";

// Servidor con logging por defecto de Fastify
const app = Fastify({ logger: true });

// CORS para permitir peticiones desde la UI (localhost o LAN)
await app.register(cors, { origin: true });

await registerRoutes(app);

// Escucha en puerto 3001, host 0.0.0.0 para acceso desde LAN
const port = parseInt(process.env.PORT ?? "3001", 10);
await app.listen({ port, host: "0.0.0.0" });

console.log(`VERIDIS Core running on http://localhost:${port}`);
