/** Estado del sistema en memoria */
export type VeridisEventLevel = "info" | "warning" | "critical";

export interface VeridisEvent {
  type: string;
  source: string;
  level: VeridisEventLevel;
  message: string;
  payload?: unknown;
  timestamp: string; // ISO 8601
}

export interface SystemState {
  status: "idle" | "processing" | "alert";
  lastEvent: VeridisEvent | null;
  recentEvents: VeridisEvent[];
  updatedAt: string; // ISO 8601
}
