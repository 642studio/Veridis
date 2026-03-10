import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { BridgeOrchestrator } from "../../src/orchestrator/orchestrator.js";
import { WakewordDetector } from "../../src/wakeword/wakeword_detector.js";

function makeCommonDeps(overrides?: {
  cameraCapture?: { capture: (source: "turn.start" | "turn.end") => Promise<unknown> };
  openClaw?: { respond: (prompt: string) => Promise<{ text: string; latencyMs: number }> };
}) {
  class FakeRealtime extends EventEmitter {
    public start = vi.fn(async () => {});
    public stop = vi.fn(() => {});
    public isConnected = vi.fn(() => true);
    public appendInputAudio = vi.fn((_chunk: Buffer) => {});
    public speakText = vi.fn(async (_text: string) => {});
  }

  class FakeMicrophone extends EventEmitter {
    public start = vi.fn(() => {});
    public stop = vi.fn(() => {});
    public isRunning = vi.fn(() => true);
  }

  const realtime = new FakeRealtime();
  const microphone = new FakeMicrophone();

  const coreEvents = {
    emit: vi.fn(async () => {}),
  };

  const deps = {
    realtimeClient: realtime as unknown as any,
    microphone: microphone as unknown as any,
    speaker: {
      beginStream: vi.fn(),
      writeChunk: vi.fn(),
      endStream: vi.fn(),
      stop: vi.fn(),
    } as any,
    cameraCapture:
      overrides?.cameraCapture ??
      ({
        capture: vi.fn(async (source: "turn.start" | "turn.end") => ({
          path: `/tmp/${source}.jpg`,
          capturedAt: new Date().toISOString(),
          source,
        })),
      } as any),
    visionSummarizer: {
      summarize: vi.fn(async () => ({
        summary: "Vision summary",
        model: "gpt-4.1-mini",
        latencyMs: 10,
        snapshots: [],
      })),
    } as any,
    openClaw:
      overrides?.openClaw ??
      ({
        respond: vi.fn(async (_prompt: string) => ({
          text: "Respuesta normal",
          latencyMs: 10,
        })),
      } as any),
    coreEvents: coreEvents as any,
    wakewordDetector: new WakewordDetector("oye veridis"),
  };

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const orchestrator = new BridgeOrchestrator(deps, {
    wakeCooldownMs: 1,
    turnCooldownMs: 1,
    keepSnapshots: false,
    wakePhrase: "oye veridis",
    micDevice: "default",
    cameraDevice: "/dev/video0",
    speakerSampleRate: 24000,
    logger,
  });

  return { deps, realtime, coreEvents, orchestrator };
}

describe("BridgeOrchestrator integration failures", () => {
  it("degrades gracefully when camera capture fails", async () => {
    const { realtime, coreEvents, orchestrator } = makeCommonDeps({
      cameraCapture: {
        capture: vi.fn(async () => {
          throw new Error("camera disconnected");
        }),
      },
    });

    await orchestrator.start();
    realtime.emit("transcript.final", { text: "oye veridis dime el estado" });

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(coreEvents.emit).toHaveBeenCalledWith(
      "console.turn.completed",
      "Voice turn completed",
      expect.any(Object),
    );

    orchestrator.stop();
  });

  it("emits turn.failed and fallback speech when OpenClaw fails", async () => {
    const { deps, realtime, coreEvents, orchestrator } = makeCommonDeps({
      openClaw: {
        respond: vi.fn(async () => {
          throw new Error("openclaw offline");
        }),
      },
    });

    await orchestrator.start();
    realtime.emit("transcript.final", { text: "oye veridis ejecuta prueba" });

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(coreEvents.emit).toHaveBeenCalledWith(
      "console.turn.failed",
      "Voice turn failed",
      expect.objectContaining({ error: expect.stringContaining("openclaw offline") }),
      "warning",
    );

    expect((deps.realtimeClient as any).speakText).toHaveBeenCalled();

    orchestrator.stop();
  });
});
