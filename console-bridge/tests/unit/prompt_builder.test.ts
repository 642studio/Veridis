import { describe, expect, it } from "vitest";

import { buildOpenClawPrompt } from "../../src/orchestrator/prompt_builder.js";

describe("buildOpenClawPrompt", () => {
  it("includes vision section when summary exists", () => {
    const prompt = buildOpenClawPrompt({
      userUtterance: "que esta pasando?",
      visionSummary: {
        summary: "Se ve una mesa y una laptop encendida.",
        model: "gpt-4.1-mini",
        latencyMs: 120,
        snapshots: [],
      },
    });

    expect(prompt).toContain("Usuario: que esta pasando?");
    expect(prompt).toContain("Vision (gpt-4.1-mini, 120ms): Se ve una mesa");
  });

  it("falls back when no vision is available", () => {
    const prompt = buildOpenClawPrompt({
      userUtterance: "hola",
    });

    expect(prompt).toContain("Vision: sin contexto visual disponible.");
  });
});
