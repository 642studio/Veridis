import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import type { BridgeOrchestrator } from "../orchestrator/orchestrator.js";
import type { Logger } from "../util/logger.js";
import { renderDashboardHtml } from "./ui_html.js";

export interface BridgeApiServerOptions {
  port: number;
  orchestrator: BridgeOrchestrator;
  logger: Logger;
}

export class BridgeApiServer {
  private app: FastifyInstance;

  constructor(private readonly options: BridgeApiServerOptions) {
    this.app = Fastify({ logger: false });
    this.registerRoutes();
  }

  public async start(): Promise<void> {
    await this.app.listen({
      port: this.options.port,
      host: "0.0.0.0",
    });

    this.options.logger.info("Bridge API server listening", {
      port: this.options.port,
    });
  }

  public async stop(): Promise<void> {
    await this.app.close();
  }

  private registerRoutes(): void {
    this.app.get("/", async (_request, reply) => {
      return reply.redirect("/dashboard");
    });

    this.app.get("/health", async () => {
      return {
        ok: true,
        service: "veridis-console-bridge",
        timestamp: new Date().toISOString(),
      };
    });

    this.app.get("/status", async () => {
      return this.options.orchestrator.getStatus();
    });

    this.app.get("/dashboard/data", async () => {
      return this.options.orchestrator.getDashboardData();
    });

    this.app.get("/dashboard", async (_request, reply) => {
      return reply.type("text/html; charset=utf-8").send(renderDashboardHtml());
    });

    this.app.post("/control/mute", async (_request, reply) => {
      this.options.orchestrator.mute();
      return reply.status(200).send({
        ok: true,
        muted: true,
        status: this.options.orchestrator.getStatus(),
      });
    });

    this.app.post("/control/unmute", async (_request, reply) => {
      this.options.orchestrator.unmute();
      return reply.status(200).send({
        ok: true,
        muted: false,
        status: this.options.orchestrator.getStatus(),
      });
    });

    this.app.post("/control/test-turn", async (request, reply) => {
      const schema = z.object({
        utterance: z.string().min(1),
      });

      const parsed = schema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: "Invalid payload",
          details: parsed.error.flatten(),
        });
      }

      try {
        const turnId = await this.options.orchestrator.runManualTurn(
          parsed.data.utterance,
        );
        return reply.status(202).send({
          ok: true,
          turnId,
          status: this.options.orchestrator.getStatus(),
        });
      } catch (error) {
        return reply.status(409).send({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          status: this.options.orchestrator.getStatus(),
        });
      }
    });

    this.app.post("/control/test-speak", async (request, reply) => {
      const schema = z.object({
        text: z.string().min(1),
      });

      const parsed = schema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          ok: false,
          error: "Invalid payload",
          details: parsed.error.flatten(),
        });
      }

      try {
        await this.options.orchestrator.runSpeakerProbe(parsed.data.text);
        return reply.status(202).send({
          ok: true,
          status: this.options.orchestrator.getStatus(),
        });
      } catch (error) {
        return reply.status(409).send({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          status: this.options.orchestrator.getStatus(),
        });
      }
    });
  }
}
