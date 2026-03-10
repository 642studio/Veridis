import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { unlink } from "node:fs/promises";

import type { BridgeState, BridgeStatus, Snapshot, TurnContext } from "../types.js";
import type { CameraCapture } from "../camera/camera_capture.js";
import type { CoreEventsClient } from "../core/core_events.js";
import type { OpenClawAdapter } from "../openclaw/openclaw_adapter.js";
import type { RealtimeClient } from "../realtime/realtime_client.js";
import type { WakewordDetector } from "../wakeword/wakeword_detector.js";
import type { VisionSummarizer } from "../vision/vision_summarizer.js";
import type { MicrophoneCapture, SpeakerPlayback } from "../audio/audio_capture.js";
import { buildOpenClawPrompt } from "./prompt_builder.js";
import type { Logger } from "../util/logger.js";

export interface BridgeOrchestratorOptions {
  wakeCooldownMs: number;
  turnCooldownMs: number;
  keepSnapshots: boolean;
  wakePhrase: string;
  micDevice: string;
  cameraDevice: string;
  speakerSampleRate: number;
  logger: Logger;
}

export interface BridgeOrchestratorDeps {
  realtimeClient: RealtimeClient;
  microphone: MicrophoneCapture;
  speaker: SpeakerPlayback;
  cameraCapture: CameraCapture;
  visionSummarizer: VisionSummarizer;
  openClaw: OpenClawAdapter;
  coreEvents: CoreEventsClient;
  wakewordDetector: WakewordDetector;
}

interface OrchestratorEvents {
  state: [BridgeState];
  error: [Error];
}

export class BridgeOrchestrator extends EventEmitter<OrchestratorEvents> {
  private state: BridgeState = "idle";
  private muted = false;
  private lastWakeAt = 0;
  private activeTurn: TurnContext | null = null;
  private lastTurn: BridgeStatus["lastTurn"] = null;
  private listeningTimeout: NodeJS.Timeout | null = null;
  private started = false;

  constructor(
    private readonly deps: BridgeOrchestratorDeps,
    private readonly options: BridgeOrchestratorOptions,
  ) {
    super();
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    this.attachRealtimeListeners();
    this.deps.microphone.on("audio", (chunk) => {
      if (this.muted) {
        return;
      }
      try {
        this.deps.realtimeClient.appendInputAudio(chunk);
      } catch (error) {
        this.options.logger.warn("Failed to append audio chunk", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.deps.microphone.on("error", (error) => {
      this.options.logger.warn("Microphone capture error", { error: error.message });
    });

    await this.deps.realtimeClient.start();
    this.deps.microphone.start();

    this.setState("armed");
    await this.deps.coreEvents.emit("console.session.started", "Console bridge session started", {
      wakePhrase: this.options.wakePhrase,
      cameraDevice: this.options.cameraDevice,
      micDevice: this.options.micDevice,
      speakerSampleRate: this.options.speakerSampleRate,
    });
  }

  public stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.clearListeningTimeout();

    this.deps.microphone.stop();
    this.deps.speaker.stop();
    this.deps.realtimeClient.stop();

    this.setState("idle");
  }

  public mute(): void {
    this.muted = true;
  }

  public unmute(): void {
    this.muted = false;
  }

  public async runManualTurn(utterance: string): Promise<string> {
    const normalizedUtterance = utterance.trim();
    if (!normalizedUtterance) {
      throw new Error("Manual turn utterance cannot be empty");
    }

    if (this.state === "thinking" || this.state === "speaking") {
      throw new Error("Bridge is busy processing another turn");
    }

    this.activeTurn = {
      id: randomUUID(),
      wakewordDetectedAt: Date.now(),
      wakeTranscript: "[manual.trigger]",
      utterance: normalizedUtterance,
    };

    const turnId = this.activeTurn.id;
    await this.runTurn(normalizedUtterance, this.activeTurn.wakeTranscript);
    return turnId;
  }

  public getStatus(): BridgeStatus {
    return {
      state: this.state,
      muted: this.muted,
      wakePhrase: this.options.wakePhrase,
      lastWakeAt: this.lastWakeAt > 0 ? new Date(this.lastWakeAt).toISOString() : null,
      runtime: {
        realtimeConnected: this.deps.realtimeClient.isConnected(),
        microphoneRunning: this.deps.microphone.isRunning(),
      },
      lastTurn: this.lastTurn,
      devices: {
        cameraDevice: this.options.cameraDevice,
        micDevice: this.options.micDevice,
        speakerSampleRate: this.options.speakerSampleRate,
      },
    };
  }

  private attachRealtimeListeners(): void {
    this.deps.realtimeClient.on("transcript.partial", (event) => {
      if (this.muted) {
        return;
      }
      if (this.state !== "armed" && this.state !== "listening") {
        return;
      }
      if (!this.deps.wakewordDetector.matches(event.text)) {
        return;
      }
      this.onWakewordDetected(event.text);
    });

    this.deps.realtimeClient.on("transcript.final", (event) => {
      void this.handleFinalTranscript(event.text);
    });

    this.deps.realtimeClient.on("audio.delta", (event) => {
      if (this.state !== "speaking") {
        return;
      }
      const chunk = Buffer.from(event.audioBase64, "base64");
      this.deps.speaker.writeChunk(chunk);
    });

    this.deps.realtimeClient.on("audio.done", () => {
      this.deps.speaker.endStream();
    });

    this.deps.realtimeClient.on("error", (error) => {
      this.emit("error", error);
      this.options.logger.error("Realtime client error", { error: error.message });
    });
  }

  private async handleFinalTranscript(rawText: string): Promise<void> {
    if (this.muted) {
      return;
    }

    const text = rawText.trim();
    if (!text) {
      return;
    }

    if (this.state === "armed") {
      if (!this.deps.wakewordDetector.matches(text)) {
        return;
      }
      this.onWakewordDetected(text);
      const utterance = this.deps.wakewordDetector.extractUtterance(text);
      if (utterance) {
        await this.runTurn(utterance, text);
      }
      return;
    }

    if (this.state === "listening") {
      this.clearListeningTimeout();
      const utterance = this.deps.wakewordDetector.matches(text)
        ? this.deps.wakewordDetector.extractUtterance(text)
        : text;

      if (!utterance.trim()) {
        this.setState("armed");
        return;
      }

      await this.runTurn(utterance, text);
    }
  }

  private onWakewordDetected(transcript: string): void {
    const now = Date.now();
    if (now - this.lastWakeAt < this.options.wakeCooldownMs) {
      return;
    }

    this.lastWakeAt = now;
    this.activeTurn = {
      id: randomUUID(),
      wakewordDetectedAt: now,
      wakeTranscript: transcript,
      utterance: "",
    };

    this.setState("listening");
    this.scheduleListeningTimeout();

    void this.deps.coreEvents.emit(
      "console.wakeword.detected",
      "Wake phrase detected",
      {
        transcript,
      },
      "info",
    );
  }

  private scheduleListeningTimeout(): void {
    this.clearListeningTimeout();
    this.listeningTimeout = setTimeout(() => {
      if (this.state === "listening") {
        this.options.logger.info("Listening timeout reached; returning to armed state");
        this.setState("armed");
      }
    }, 7_000);
  }

  private clearListeningTimeout(): void {
    if (!this.listeningTimeout) {
      return;
    }
    clearTimeout(this.listeningTimeout);
    this.listeningTimeout = null;
  }

  private async runTurn(utterance: string, wakeTranscript: string): Promise<void> {
    if (!this.activeTurn) {
      this.activeTurn = {
        id: randomUUID(),
        wakewordDetectedAt: Date.now(),
        wakeTranscript,
        utterance,
      };
    }

    const turn = this.activeTurn;
    turn.utterance = utterance.trim();

    const turnStart = Date.now();
    const snapshots: Snapshot[] = [];
    this.setState("thinking");

    try {
      try {
        snapshots.push(await this.deps.cameraCapture.capture("turn.start"));
      } catch (error) {
        this.options.logger.warn("Failed to capture start snapshot", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        snapshots.push(await this.deps.cameraCapture.capture("turn.end"));
      } catch (error) {
        this.options.logger.warn("Failed to capture end snapshot", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      turn.visionSummary = await this.deps.visionSummarizer.summarize(snapshots);
      await this.deps.coreEvents.emit("console.vision.summary", "Vision summary produced", {
        turnId: turn.id,
        summary: turn.visionSummary.summary,
        model: turn.visionSummary.model,
        snapshots: turn.visionSummary.snapshots,
      });

      const prompt = buildOpenClawPrompt({
        userUtterance: turn.utterance,
        visionSummary: turn.visionSummary,
      });

      const openclawReply = await this.deps.openClaw.respond(prompt);
      turn.openclawReply = openclawReply.text;

      this.setState("speaking");
      this.deps.speaker.beginStream();
      await this.deps.realtimeClient.speakText(openclawReply.text);

      turn.finishedAt = Date.now();
      const latencyMs = turn.finishedAt - turnStart;

      this.lastTurn = {
        id: turn.id,
        utterance: turn.utterance,
        replyPreview: openclawReply.text.slice(0, 160),
        latencyMs,
        finishedAt: new Date(turn.finishedAt).toISOString(),
      };

      await this.deps.coreEvents.emit("console.turn.completed", "Voice turn completed", {
        turnId: turn.id,
        utterance: turn.utterance,
        wakeTranscript: turn.wakeTranscript,
        reply: openclawReply.text,
        latencyMs,
      });

      await this.enterCooldown();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      turn.error = errorMessage;

      this.lastTurn = {
        id: turn.id,
        utterance: turn.utterance,
        replyPreview: "",
        latencyMs: Date.now() - turnStart,
        finishedAt: new Date().toISOString(),
        error: errorMessage,
      };

      this.options.logger.error("Turn failed", {
        error: errorMessage,
        turnId: turn.id,
      });

      await this.deps.coreEvents.emit(
        "console.turn.failed",
        "Voice turn failed",
        {
          turnId: turn.id,
          utterance: turn.utterance,
          error: errorMessage,
        },
        "warning",
      );

      try {
        this.setState("speaking");
        this.deps.speaker.beginStream();
        await this.deps.realtimeClient.speakText(
          "Perdon, tuve un error al procesar tu solicitud. Intenta de nuevo en unos segundos.",
        );
      } catch (speakError) {
        this.options.logger.warn("Fallback speech failed", {
          error: speakError instanceof Error ? speakError.message : String(speakError),
        });
      }

      await this.enterCooldown();
    } finally {
      await this.cleanupSnapshots(snapshots);
      this.activeTurn = null;
    }
  }

  private async enterCooldown(): Promise<void> {
    this.setState("cooldown");
    await new Promise((resolve) => setTimeout(resolve, this.options.turnCooldownMs));
    this.setState("armed");
  }

  private setState(nextState: BridgeState): void {
    if (this.state === nextState) {
      return;
    }
    this.state = nextState;
    this.emit("state", nextState);
    this.options.logger.info("Bridge state changed", { state: nextState });
  }

  private async cleanupSnapshots(snapshots: Snapshot[]): Promise<void> {
    if (this.options.keepSnapshots || snapshots.length === 0) {
      return;
    }

    const uniquePaths = [...new Set(snapshots.map((snapshot) => snapshot.path))];
    await Promise.all(
      uniquePaths.map(async (path) => {
        try {
          await unlink(path);
        } catch (error) {
          this.options.logger.debug("Failed to delete snapshot", {
            path,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  }
}
