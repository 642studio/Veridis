import { describe, expect, it } from "vitest";

import { extractOpenClawText } from "../../src/openclaw/openclaw_adapter.js";

describe("extractOpenClawText", () => {
  it("prioritizes result.payloads[].text over metadata like runId", () => {
    const input = {
      runId: "cbac3fee-5c8a-42c1-9199-696764006210",
      status: "ok",
      result: {
        payloads: [
          {
            text: "Hola, aqui ando. ¿Que hacemos ahora?",
            mediaUrl: null,
          },
        ],
      },
    };

    expect(extractOpenClawText(input)).toBe("Hola, aqui ando. ¿Que hacemos ahora?");
  });

  it("avoids returning uuid-like strings when searching fallback text", () => {
    const input = {
      runId: "cbac3fee-5c8a-42c1-9199-696764006210",
      result: {
        meta: {
          sessionId: "b6540c6b-b711-4679-a6d5-b26143a7ff2b",
        },
        message: "Respuesta util",
      },
    };

    expect(extractOpenClawText(input)).toBe("Respuesta util");
  });
});
