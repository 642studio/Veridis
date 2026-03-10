export type BridgeState =
  | "idle"
  | "armed"
  | "listening"
  | "thinking"
  | "speaking"
  | "cooldown";

export type BridgeEventLevel = "info" | "warning" | "critical";

export interface Snapshot {
  path: string;
  capturedAt: string;
  source: "turn.start" | "turn.end";
}

export interface VisionSummary {
  summary: string;
  model: string;
  latencyMs: number;
  snapshots: Snapshot[];
}

export interface TurnContext {
  id: string;
  wakewordDetectedAt: number;
  utterance: string;
  wakeTranscript: string;
  visionSummary?: VisionSummary;
  openclawReply?: string;
  finishedAt?: number;
  error?: string;
}

export interface BridgeStatus {
  state: BridgeState;
  muted: boolean;
  wakePhrase: string;
  lastWakeAt: string | null;
  runtime: {
    realtimeConnected: boolean;
    microphoneRunning: boolean;
  };
  lastTurn: {
    id: string;
    utterance: string;
    replyPreview: string;
    latencyMs: number;
    finishedAt: string;
    error?: string;
  } | null;
  devices: {
    cameraDevice: string;
    micDevice: string;
    speakerSampleRate: number;
  };
}

export interface OpenClawReply {
  text: string;
  raw?: unknown;
  latencyMs: number;
}

export interface CoreEventPayload {
  type: string;
  source: string;
  level: BridgeEventLevel;
  message: string;
  payload?: unknown;
  timestamp: string;
}

export interface RealtimeTranscriptionEvent {
  text: string;
  eventId?: string;
  itemId?: string;
}

export interface RealtimeAudioDeltaEvent {
  responseId: string;
  audioBase64: string;
}
