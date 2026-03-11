import { describe, expect, it } from "vitest";

import { WakewordDetector } from "../../src/wakeword/wakeword_detector.js";

describe("WakewordDetector", () => {
  it("detects wake phrase in normalized text", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.matches("Oye, Veridis! estas ahi?")).toBe(true);
  });

  it("detects wake phrase with common ASR variations", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.matches("Oye, Belis, dime el estado")).toBe(true);
    expect(detector.matches("oye beridis responde")).toBe(true);
  });

  it("does not trigger if lead token differs", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.matches("hola belis dime el estado")).toBe(false);
  });

  it("extracts utterance after wake phrase", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.extractUtterance("oye veridis dime el estado del sistema")).toBe(
      "dime el estado del sistema",
    );
  });

  it("extracts utterance after fuzzy wake phrase", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.extractUtterance("Oye, Belis, dime qué estás viendo")).toBe(
      "dime que estas viendo",
    );
  });

  it("returns trimmed text when wake phrase is absent", () => {
    const detector = new WakewordDetector("oye veridis");
    expect(detector.extractUtterance("estado actual del sistema")).toBe(
      "estado actual del sistema",
    );
  });
});
