import { EventEmitter } from "node:events";

import WebSocket from "ws";

import type {
  RealtimeAudioDeltaEvent,
  RealtimeTranscriptionEvent,
} from "../types.js";
import type { Logger } from "../util/logger.js";

export interface RealtimeClientOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  voice: string;
  transcribeModel: string;
  transcribeLanguage?: string;
  transcribePrompt?: string;
  reconnectBaseMs?: number;
  logger: Logger;
}

interface RealtimeEvents {
  connected: [];
  disconnected: [];
  error: [Error];
  "transcript.partial": [RealtimeTranscriptionEvent];
  "transcript.final": [RealtimeTranscriptionEvent];
  "audio.delta": [RealtimeAudioDeltaEvent];
  "audio.done": [{ responseId: string }];
}

interface PendingSpeakRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  responseId?: string;
}

interface RealtimeIncomingEvent {
  type?: string;
  [key: string]: unknown;
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class RealtimeClient extends EventEmitter<RealtimeEvents> {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly reconnectBaseMs: number;
  private started = false;

  private pendingSpeaks = new Map<string, PendingSpeakRequest>();
  private responseToRequest = new Map<string, string>();

  constructor(private readonly options: RealtimeClientOptions) {
    super();
    this.reconnectBaseMs = options.reconnectBaseMs ?? 1000;
  }

  public async start(): Promise<void> {
    this.started = true;
    await this.connect();
  }

  public stop(): void {
    this.started = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000, "bridge-stop");
    this.ws = null;

    for (const [requestId, pending] of this.pendingSpeaks.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Realtime client stopped before response for request ${requestId}`));
    }
    this.pendingSpeaks.clear();
    this.responseToRequest.clear();
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public appendInputAudio(chunk: Buffer): void {
    if (!this.isConnected()) {
      return;
    }
    this.send({
      type: "input_audio_buffer.append",
      audio: chunk.toString("base64"),
    });
  }

  public async speakText(text: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Realtime websocket is not connected");
    }

    const requestId = randomId("speak");
    const timeout = setTimeout(() => {
      const pending = this.pendingSpeaks.get(requestId);
      if (!pending) {
        return;
      }
      this.pendingSpeaks.delete(requestId);
      pending.reject(new Error(`Timed out waiting for realtime response (${requestId})`));
    }, 45_000);

    const promise = new Promise<void>((resolve, reject) => {
      this.pendingSpeaks.set(requestId, { resolve, reject, timeout });
    });

    this.send({
      type: "response.create",
      response: {
        conversation: "none",
        modalities: ["audio", "text"],
        instructions:
          "Lee en voz alta exactamente el texto proporcionado, en espanol natural y sin agregar informacion.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text,
              },
            ],
          },
        ],
        metadata: {
          bridge_request_id: requestId,
        },
      },
    });

    return promise;
  }

  private async connect(): Promise<void> {
    const url = `${this.options.baseUrl}?model=${encodeURIComponent(this.options.model)}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      let opened = false;

      ws.on("open", () => {
        opened = true;
        this.ws = ws;
        this.reconnectAttempts = 0;
        this.configureSession();
        this.emit("connected");
        this.options.logger.info("Realtime websocket connected");
        resolve();
      });

      ws.on("message", (rawData) => {
        this.handleMessage(rawData.toString("utf8"));
      });

      ws.on("error", (error) => {
        this.emit("error", error);
        if (!opened) {
          reject(error);
        }
      });

      ws.on("close", (code, reason) => {
        this.options.logger.warn("Realtime websocket closed", {
          code,
          reason: reason.toString("utf8"),
        });
        this.ws = null;
        this.emit("disconnected");
        if (this.started) {
          this.scheduleReconnect();
        }
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const backoff = Math.min(this.reconnectBaseMs * 2 ** this.reconnectAttempts, 15_000);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        this.options.logger.error("Realtime reconnect failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        this.scheduleReconnect();
      }
    }, backoff);
  }

  private configureSession(): void {
    const language = this.options.transcribeLanguage?.trim();
    const transcriptionPrompt = this.options.transcribePrompt?.trim();
    this.send({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        voice: this.options.voice,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: this.options.transcribeModel,
          ...(language ? { language } : {}),
          ...(transcriptionPrompt ? { prompt: transcriptionPrompt } : {}),
        },
        turn_detection: {
          type: "server_vad",
          create_response: false,
        },
      },
    });
  }

  private handleMessage(rawData: string): void {
    let event: RealtimeIncomingEvent;
    try {
      event = JSON.parse(rawData) as RealtimeIncomingEvent;
    } catch {
      this.options.logger.warn("Failed to parse realtime message", { rawData });
      return;
    }

    const eventType = typeof event.type === "string" ? event.type : "unknown";

    switch (eventType) {
      case "conversation.item.input_audio_transcription.delta": {
        const text = typeof event.delta === "string" ? event.delta : "";
        if (text) {
          this.emit("transcript.partial", {
            text,
            eventId: typeof event.event_id === "string" ? event.event_id : undefined,
            itemId: typeof event.item_id === "string" ? event.item_id : undefined,
          });
        }
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const transcript =
          typeof event.transcript === "string"
            ? event.transcript
            : typeof event.text === "string"
              ? event.text
              : "";
        if (transcript) {
          this.emit("transcript.final", {
            text: transcript,
            eventId: typeof event.event_id === "string" ? event.event_id : undefined,
            itemId: typeof event.item_id === "string" ? event.item_id : undefined,
          });
        }
        break;
      }

      case "response.created": {
        const response =
          event.response && typeof event.response === "object"
            ? (event.response as Record<string, unknown>)
            : null;
        const responseId = response && typeof response.id === "string" ? response.id : undefined;
        const metadata =
          response && response.metadata && typeof response.metadata === "object"
            ? (response.metadata as Record<string, unknown>)
            : null;
        const requestId = metadata && typeof metadata.bridge_request_id === "string" ? metadata.bridge_request_id : undefined;
        if (responseId && requestId) {
          const pending = this.pendingSpeaks.get(requestId);
          if (pending) {
            pending.responseId = responseId;
            this.responseToRequest.set(responseId, requestId);
          }
        }
        break;
      }

      case "response.audio.delta": {
        const responseId = typeof event.response_id === "string" ? event.response_id : "";
        const audioBase64 = typeof event.delta === "string" ? event.delta : "";
        if (responseId && audioBase64) {
          this.emit("audio.delta", { responseId, audioBase64 });
        }
        break;
      }

      case "response.done": {
        const response =
          event.response && typeof event.response === "object"
            ? (event.response as Record<string, unknown>)
            : null;
        const responseId = response && typeof response.id === "string" ? response.id : undefined;

        if (responseId) {
          this.emit("audio.done", { responseId });
          const requestId = this.responseToRequest.get(responseId);
          if (requestId) {
            this.responseToRequest.delete(responseId);
            const pending = this.pendingSpeaks.get(requestId);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingSpeaks.delete(requestId);
              pending.resolve();
            }
          }
        }
        break;
      }

      case "error": {
        const errorText =
          event.error && typeof event.error === "object"
            ? JSON.stringify(event.error)
            : rawData;
        this.emit("error", new Error(`Realtime error event: ${errorText}`));
        break;
      }

      default:
        break;
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime websocket is not open");
    }
    this.ws.send(JSON.stringify(payload));
  }
}
