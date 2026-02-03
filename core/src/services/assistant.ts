import type { SystemState, VeridisEventLevel } from "../types.js";

export type AssistantQueryRequest = {
  // Placeholder for future expansions (filters, verbosity, etc.)
  verbose?: boolean;
};

export type AssistantQueryResponse = {
  ok: true;
  status: SystemState["status"]; // derived status
  summary: string;
  suggestedActions: string[];
  updatedAt: string;
  lastEvent: SystemState["lastEvent"];
  recentEvents?: SystemState["recentEvents"];
};

function statusFromLevel(level?: VeridisEventLevel): SystemState["status"] {
  if (level === "critical") return "alert";
  if (level === "warning") return "processing";
  return "idle";
}

function buildSummary(state: SystemState): string {
  if (!state.lastEvent) {
    if (state.status === "processing") return "System is processing.";
    return "System is idle. No recent activity.";
  }

  const ev = state.lastEvent;
  if (ev.level === "critical") return `Critical alert: ${ev.message}`;
  if (ev.level === "warning") return `Attention required: ${ev.message}`;
  return `Info: ${ev.message}`;
}

function buildSuggestedActions(state: SystemState): string[] {
  const derivedStatus = statusFromLevel(state.lastEvent?.level);
  if (derivedStatus === "alert") return ["Review alert details", "Run the relevant runbook", "Notify owner"];
  if (derivedStatus === "processing") return ["Monitor progress", "Check event stream", "Wait for completion"];
  return ["Check system status", "Emit a test event", "Review recent changes"];
}

export function assistantQuery(state: SystemState, req?: AssistantQueryRequest): AssistantQueryResponse {
  const derivedStatus = statusFromLevel(state.lastEvent?.level);
  const base: AssistantQueryResponse = {
    ok: true,
    status: derivedStatus,
    summary: buildSummary({ ...state, status: derivedStatus }),
    suggestedActions: buildSuggestedActions({ ...state, status: derivedStatus }),
    updatedAt: state.updatedAt,
    lastEvent: state.lastEvent,
  };

  if (req?.verbose) {
    // newest-first (keep it small)
    base.recentEvents = state.recentEvents.slice(-10).reverse();
  }

  return base;
}
