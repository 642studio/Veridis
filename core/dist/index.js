import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes.js";
// Servidor con logging por defecto de Fastify
const app = Fastify({ logger: true });
// CORS para permitir peticiones desde la UI (puerto 3000)
await app.register(cors, { origin: "http://localhost:3000" });
await registerRoutes(app);
// Escucha en puerto 3001, host 0.0.0.0 para acceso desde LAN
const port = parseInt(process.env.PORT ?? "3001", 10);
await app.listen({ port, host: "0.0.0.0" });
console.log(`VERIDIS Core running on http://localhost:${port}`);
