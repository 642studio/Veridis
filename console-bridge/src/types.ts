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
    speakerDevice: string;
    speakerBackend: "ffplay" | "aplay";
    speakerSampleRate: number;
  };
}

export interface VisionSnapshotPreview {
  source: Snapshot["source"];
  capturedAt: string;
  path: string;
  imageDataUrl?: string;
}

export interface BridgeInteraction {
  turnId: string;
  wakeTranscript: string;
  utterance: string;
  reply: string;
  visionSummary: string;
  visionModel: string;
  snapshots: VisionSnapshotPreview[];
  latencyMs: number;
  finishedAt: string;
  error?: string;
}

export interface BridgeTranscriptStatus {
  partial: string | null;
  final: string | null;
  updatedAt: string | null;
}

export interface BridgeActivityEvent {
  id: string;
  at: string;
  type:
    | "system"
    | "state"
    | "wakeword"
    | "wakeword.eval"
    | "transcript.final"
    | "turn.completed"
    | "turn.failed";
  message: string;
  data?: Record<string, unknown>;
}

export interface BridgeDashboardData {
  status: BridgeStatus;
  interaction: BridgeInteraction | null;
  transcripts: BridgeTranscriptStatus;
  activity: BridgeActivityEvent[];
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
