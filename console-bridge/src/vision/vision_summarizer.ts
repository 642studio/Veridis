import { readFile } from "node:fs/promises";

import type { Snapshot, VisionSummary } from "../types.js";
import type { Logger } from "../util/logger.js";

export interface VisionSummarizerOptions {
  apiKey?: string;
  model?: string;
  logger: Logger;
}

interface ResponsesApiResult {
  output_text?: string;
}

export class VisionSummarizer {
  private readonly model: string;

  constructor(private readonly options: VisionSummarizerOptions) {
    this.model = options.model ?? "gpt-4.1-mini";
  }

  public async summarize(snapshots: Snapshot[]): Promise<VisionSummary> {
    const start = Date.now();

    if (snapshots.length === 0) {
      return {
        summary: "No camera snapshots were captured for this turn.",
        model: this.model,
        latencyMs: Date.now() - start,
        snapshots,
      };
    }

    if (!this.options.apiKey) {
      const fallback = this.buildFallbackSummary(snapshots);
      return {
        summary: fallback,
        model: "fallback/local",
        latencyMs: Date.now() - start,
        snapshots,
      };
    }

    try {
      const content: Array<{ type: string; text?: string; image_url?: string }> = [
        {
          type: "input_text",
          text:
            "Resume brevemente (maximo 2 frases) lo visible en estas imagenes para contexto conversacional. Si no hay nada relevante, dilo claramente.",
        },
      ];

      for (const snapshot of snapshots) {
        const imageBuffer = await readFile(snapshot.path);
        const imageUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
        content.push({
          type: "input_text",
          text: `Snapshot ${snapshot.source} at ${snapshot.capturedAt}`,
        });
        content.push({
          type: "input_image",
          image_url: imageUrl,
        });
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          max_output_tokens: 120,
          input: [
            {
              role: "user",
              content,
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Responses API failed (${response.status}): ${body}`);
      }

      const result = (await response.json()) as ResponsesApiResult;
      const summary =
        typeof result.output_text === "string" && result.output_text.trim()
          ? result.output_text.trim()
          : this.buildFallbackSummary(snapshots);

      return {
        summary,
        model: this.model,
        latencyMs: Date.now() - start,
        snapshots,
      };
    } catch (error) {
      this.options.logger.warn("Vision summarization failed; using fallback", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        summary: this.buildFallbackSummary(snapshots),
        model: "fallback/local",
        latencyMs: Date.now() - start,
        snapshots,
      };
    }
  }

  private buildFallbackSummary(snapshots: Snapshot[]): string {
    const descriptions = snapshots
      .map((snapshot) => `${snapshot.source}=${snapshot.path}`)
      .join(", ");
    return `Vision summary unavailable from API. Captured snapshots: ${descriptions}.`;
  }
}
