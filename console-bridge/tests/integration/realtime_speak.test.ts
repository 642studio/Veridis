import { describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";

import { RealtimeClient } from "../../src/realtime/realtime_client.js";

function createClient(port: number): RealtimeClient {
  return new RealtimeClient({
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
}

function startServer(port: number): Promise<WebSocketServer> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port }, () => resolve(wss));
  });
}

describe("RealtimeClient speakText", () => {
  it("sends a typed message input payload for response.create", async () => {
    const port = 38992;
    const wss = await startServer(port);
    let responseCreatePayload: any = null;

    wss.on("connection", (socket) => {
      socket.on("message", (raw) => {
        const payload = JSON.parse(raw.toString("utf8"));
        if (payload.type !== "response.create") {
          return;
        }

        responseCreatePayload = payload;
        const requestId = payload.response?.metadata?.bridge_request_id;
        socket.send(
          JSON.stringify({
            type: "response.created",
            response: {
              id: "resp_test_1",
              metadata: {
                bridge_request_id: requestId,
              },
            },
          }),
        );
        socket.send(
          JSON.stringify({
            type: "response.done",
            response: {
              id: "resp_test_1",
            },
          }),
        );
      });
    });

    const client = createClient(port);
    client.on("error", () => {
      // Ignore async errors in this test; assertions rely on returned promise.
    });

    await client.start();
    await client.speakText("hola veridis");

    expect(responseCreatePayload).toBeTruthy();
    expect(responseCreatePayload.response.modalities).toEqual(["audio", "text"]);
    expect(responseCreatePayload.response.input[0].type).toBe("message");
    expect(responseCreatePayload.response.input[0].content[0]).toMatchObject({
      type: "input_text",
      text: "hola veridis",
    });

    client.stop();
    await new Promise((resolve) => {
      wss.close(() => resolve(undefined));
    });
  });

  it("rejects speakText immediately when realtime returns an error event", async () => {
    const port = 38993;
    const wss = await startServer(port);

    wss.on("connection", (socket) => {
      socket.on("message", (raw) => {
        const payload = JSON.parse(raw.toString("utf8"));
        if (payload.type !== "response.create") {
          return;
        }
        socket.send(
          JSON.stringify({
            type: "error",
            error: {
              type: "invalid_request_error",
              message: "Missing required parameter: response.input[0].type",
            },
          }),
        );
      });
    });

    const client = createClient(port);
    client.on("error", () => {
      // Prevent unhandled EventEmitter 'error' events in test process.
    });

    await client.start();
    const startedAt = Date.now();

    await expect(client.speakText("hola veridis")).rejects.toThrow(/invalid_request_error/);
    expect(Date.now() - startedAt).toBeLessThan(2_000);

    client.stop();
    await new Promise((resolve) => {
      wss.close(() => resolve(undefined));
    });
  });
});
