import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { BridgeOrchestrator } from "../../src/orchestrator/orchestrator.js";
import { WakewordDetector } from "../../src/wakeword/wakeword_detector.js";

function createDeps() {
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

  const deps = {
    realtimeClient: realtime as unknown as any,
    microphone: new FakeMicrophone() as unknown as any,
    speaker: {
      beginStream: vi.fn(),
      writeChunk: vi.fn(),
      endStream: vi.fn(),
      stop: vi.fn(),
    } as any,
    cameraCapture: {
      capture: vi.fn(async (source: "turn.start" | "turn.end") => ({
        path: `/tmp/${source}.jpg`,
        capturedAt: new Date().toISOString(),
        source,
      })),
    } as any,
    visionSummarizer: {
      summarize: vi.fn(async () => ({
        summary: "Vision OK",
        model: "gpt-4.1-mini",
        latencyMs: 12,
        snapshots: [],
      })),
    } as any,
    openClaw: {
      respond: vi.fn(async () => ({
        text: "Respuesta manual.",
        latencyMs: 15,
      })),
    } as any,
    coreEvents: {
      emit: vi.fn(async () => {}),
    } as any,
    wakewordDetector: new WakewordDetector("oye veridis"),
  };

  return deps;
}

describe("BridgeOrchestrator manual turn", () => {
  it("runs manual turn and stores lastTurn", async () => {
    const deps = createDeps();

    const orchestrator = new BridgeOrchestrator(deps, {
      wakeCooldownMs: 1000,
      turnCooldownMs: 1,
      keepSnapshots: false,
      wakePhrase: "oye veridis",
      micDevice: "default",
      cameraDevice: "/dev/video0",
      speakerSampleRate: 24000,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    await orchestrator.start();
    const turnId = await orchestrator.runManualTurn("dame un resumen de estado");

    expect(turnId).toBeTruthy();
    expect(deps.openClaw.respond).toHaveBeenCalled();
    expect(orchestrator.getStatus().lastTurn?.id).toBe(turnId);

    orchestrator.stop();
  });
});
