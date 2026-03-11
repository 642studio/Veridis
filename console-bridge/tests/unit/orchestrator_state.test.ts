import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { BridgeOrchestrator } from "../../src/orchestrator/orchestrator.js";
import { WakewordDetector } from "../../src/wakeword/wakeword_detector.js";

function createMocks() {
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

  const deps = {
    realtimeClient: realtime as unknown as any,
    microphone: microphone as unknown as any,
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
      summarize: vi.fn(async (_snapshots: unknown[]) => ({
        summary: "Vision OK",
        model: "gpt-4.1-mini",
        latencyMs: 50,
        snapshots: [],
      })),
    } as any,
    openClaw: {
      respond: vi.fn(async (_prompt: string) => ({
        text: "Todo en orden.",
        latencyMs: 100,
      })),
    } as any,
    coreEvents: {
      emit: vi.fn(async () => {}),
    } as any,
    wakewordDetector: new WakewordDetector("oye veridis"),
  };

  return { deps, realtime, microphone };
}

describe("BridgeOrchestrator state machine", () => {
  it("moves from armed -> listening -> thinking -> speaking -> cooldown -> armed", async () => {
    const { deps, realtime } = createMocks();

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

    const seenStates: string[] = [];
    orchestrator.on("state", (state) => {
      seenStates.push(state);
    });

    await orchestrator.start();

    realtime.emit("transcript.final", {
      text: "oye veridis dame el estado",
    });

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(seenStates).toContain("armed");
    expect(seenStates).toContain("listening");
    expect(seenStates).toContain("thinking");
    expect(seenStates).toContain("speaking");
    expect(seenStates).toContain("cooldown");

    const status = orchestrator.getStatus();
    expect(status.state).toBe("armed");
    expect(status.lastTurn?.utterance).toContain("dame el estado");

    orchestrator.stop();
  });

  it("supports push-to-talk mode without wakeword", async () => {
    const { deps, realtime } = createMocks();

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
      triggerMode: "ptt",
      micDevice: "default",
      cameraDevice: "/dev/video0",
      speakerSampleRate: 24000,
      logger,
    });

    await orchestrator.start();

    // In PTT mode, transcripts in armed state should not auto-run.
    realtime.emit("transcript.final", {
      text: "veridis dime el estado",
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(deps.openClaw.respond).not.toHaveBeenCalled();

    orchestrator.startPushToTalk();
    expect(orchestrator.getStatus().state).toBe("listening");

    realtime.emit("transcript.final", {
      text: "dime el estado del sistema",
    });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(deps.openClaw.respond).toHaveBeenCalled();
    expect(orchestrator.getStatus().state).toBe("armed");

    orchestrator.stop();
  });
});
