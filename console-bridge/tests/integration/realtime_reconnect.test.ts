import { describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";

import { RealtimeClient } from "../../src/realtime/realtime_client.js";

describe("RealtimeClient reconnect", () => {
  it("retries connection after unexpected close", async () => {
    const port = 38991;
    let connections = 0;

    const wss = new WebSocketServer({ port });

    wss.on("connection", (socket) => {
      connections += 1;

      socket.on("message", (_raw) => {
        // ignore
      });

      // Drop first connection so client must reconnect.
      if (connections === 1) {
        setTimeout(() => socket.close(), 20);
      }
    });

    const client = new RealtimeClient({
      apiKey: "test-key",
      baseUrl: `ws://127.0.0.1:${port}/realtime`,
      model: "gpt-realtime",
      voice: "alloy",
      transcribeModel: "gpt-4o-mini-transcribe",
      reconnectBaseMs: 50,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    await client.start();
    await new Promise((resolve) => setTimeout(resolve, 220));

    expect(connections).toBeGreaterThanOrEqual(2);

    client.stop();
    await new Promise((resolve) => {
      wss.close(() => resolve(undefined));
    });
  });
});
