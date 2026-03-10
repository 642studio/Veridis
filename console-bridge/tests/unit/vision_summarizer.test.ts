import { describe, expect, it } from "vitest";

import { extractVisionSummaryText } from "../../src/vision/vision_summarizer.js";

describe("extractVisionSummaryText", () => {
  it("uses output_text when available", () => {
    expect(
      extractVisionSummaryText({
        output_text: "Hay una oficina con una silla frente a la ventana.",
      }),
    ).toBe("Hay una oficina con una silla frente a la ventana.");
  });

  it("extracts text from output content blocks", () => {
    expect(
      extractVisionSummaryText({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Se observa un escritorio y una silla.",
              },
            ],
          },
        ],
      }),
    ).toBe("Se observa un escritorio y una silla.");
  });
});
