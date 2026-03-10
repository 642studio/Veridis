import { describe, expect, it } from "vitest";

import { WakewordDetector } from "../../src/wakeword/wakeword_detector.js";

describe("WakewordDetector", () => {
  it("detects wake phrase in normalized text", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.matches("Oye, Veridis! estas ahi?")).toBe(true);
  });

  it("extracts utterance after wake phrase", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.extractUtterance("oye veridis dime el estado del sistema")).toBe(
      "dime el estado del sistema",
    );
  });

  it("returns trimmed text when wake phrase is absent", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.extractUtterance("estado actual del sistema")).toBe(
      "estado actual del sistema",
    );
  });
});
