import type { VisionSummary } from "../types.js";

export interface PromptInput {
  userUtterance: string;
  visionSummary?: VisionSummary;
}

export function buildOpenClawPrompt(input: PromptInput): string {
  const sections: string[] = [
    "Sistema: Eres OpenClaw en VERIDIS. Responde en espanol, breve y accionable.",
    `Usuario: ${input.userUtterance.trim()}`,
  ];

  if (input.visionSummary) {
    sections.push(
      `Vision (${input.visionSummary.model}, ${input.visionSummary.latencyMs}ms): ${input.visionSummary.summary}`,
    );
  } else {
    sections.push("Vision: sin contexto visual disponible.");
  }

  sections.push("Instruccion: Contesta al usuario considerando este contexto.");
  return sections.join("\n\n");
}
