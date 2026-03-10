import { spawn } from "node:child_process";

import type { OpenClawReply } from "../types.js";
import type { Logger } from "../util/logger.js";

export interface OpenClawAdapterOptions {
  cliPath: string;
  agentId: string;
  sessionKey: string;
  timeoutMs: number;
  logger: Logger;
}

function extractJsonPayload(raw: string): unknown {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in OpenClaw output");
  }

  const candidate = raw.slice(firstBrace, lastBrace + 1);
  return JSON.parse(candidate);
}

function findFirstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstString(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const objectValue = value as Record<string, unknown>;
  const preferredKeys = [
    "reply",
    "text",
    "message",
    "content",
    "output_text",
    "assistant",
  ];

  for (const key of preferredKeys) {
    if (key in objectValue) {
      const found = findFirstString(objectValue[key]);
      if (found) {
        return found;
      }
    }
  }

  for (const key of Object.keys(objectValue)) {
    const found = findFirstString(objectValue[key]);
    if (found) {
      return found;
    }
  }

  return null;
}

export class OpenClawAdapter {
  constructor(private readonly options: OpenClawAdapterOptions) {}

  public async respond(prompt: string): Promise<OpenClawReply> {
    const startedAt = Date.now();

    const baseArgs = [
      "agent",
      "--agent",
      this.options.agentId,
      "--message",
      prompt,
      "--json",
      "--timeout",
      String(Math.max(1, Math.floor(this.options.timeoutMs / 1000))),
    ];

    this.options.logger.debug("Dispatching prompt to OpenClaw", {
      agentId: this.options.agentId,
      sessionKey: this.options.sessionKey,
      promptLength: prompt.length,
    });

    let stdout = "";
    let stderr = "";
    try {
      const result = await this.runCommand(
        this.options.cliPath,
        [...baseArgs, "--session-id", this.options.sessionKey],
        this.options.timeoutMs,
      );
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      this.options.logger.warn(
        "OpenClaw call with explicit session-id failed; retrying without explicit session-id",
        {
          sessionKey: this.options.sessionKey,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      const result = await this.runCommand(
        this.options.cliPath,
        baseArgs,
        this.options.timeoutMs,
      );
      stdout = result.stdout;
      stderr = result.stderr;
    }

    if (stderr.trim()) {
      this.options.logger.warn("OpenClaw emitted stderr", {
        stderr: stderr.trim().slice(0, 500),
      });
    }

    let parsed: unknown;
    try {
      parsed = extractJsonPayload(stdout);
    } catch (error) {
      this.options.logger.warn("OpenClaw output is not strict JSON", {
        error: error instanceof Error ? error.message : String(error),
      });
      const fallbackText = stdout.trim();
      return {
        text: fallbackText || "No pude obtener respuesta de OpenClaw.",
        raw: stdout,
        latencyMs: Date.now() - startedAt,
      };
    }

    const text =
      findFirstString(parsed) ?? "No pude extraer una respuesta legible desde OpenClaw.";

    return {
      text,
      raw: parsed,
      latencyMs: Date.now() - startedAt,
    };
  }

  private runCommand(
    command: string,
    args: string[],
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let killedByTimeout = false;

      const timeout = setTimeout(() => {
        killedByTimeout = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on("exit", (code) => {
        clearTimeout(timeout);

        if (killedByTimeout) {
          reject(new Error(`OpenClaw command timed out after ${timeoutMs}ms`));
          return;
        }

        if (code !== 0) {
          reject(new Error(`OpenClaw command failed with code ${code}: ${stderr.trim()}`));
          return;
        }

        resolve({ stdout, stderr });
      });
    });
  }
}
