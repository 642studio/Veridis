import type { BridgeEventLevel, CoreEventPayload } from "../types.js";
import type { Logger } from "../util/logger.js";

export interface CoreEventsClientOptions {
  coreUrl: string;
  source?: string;
  logger: Logger;
}

export class CoreEventsClient {
  private readonly source: string;

  constructor(private readonly options: CoreEventsClientOptions) {
    this.source = options.source ?? "console-bridge";
  }

  public async emit(
    type: string,
    message: string,
    payload?: unknown,
    level: BridgeEventLevel = "info",
  ): Promise<void> {
    const event: CoreEventPayload = {
      type,
      source: this.source,
      level,
      message,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${this.options.coreUrl}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Core returned ${response.status}: ${body}`);
      }
    } catch (error) {
      this.options.logger.warn("Failed to emit event to VERIDIS Core", {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.options.coreUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
