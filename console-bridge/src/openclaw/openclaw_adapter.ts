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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getByPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) {
      return undefined;
    }
    current = record[key];
  }
  return current;
}

function extractPayloadText(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }
    const text = record.text;
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  return null;
}

const METADATA_STRING_KEYS = new Set([
  "id",
  "runId",
  "sessionId",
  "status",
  "summary",
  "provider",
  "model",
  "source",
  "stopReason",
]);

const METADATA_OBJECT_KEYS = new Set([
  "meta",
  "usage",
  "lastCallUsage",
  "systemPromptReport",
  "sandbox",
  "skills",
  "tools",
  "bootstrapTruncation",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function findFirstHumanString(value: unknown, parentKey?: string): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) {
      return null;
    }
    if (parentKey && METADATA_STRING_KEYS.has(parentKey)) {
      return null;
    }
    if (UUID_REGEX.test(text)) {
      return null;
    }
    return text;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstHumanString(item, parentKey);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const objectValue = asRecord(value);
  if (!objectValue) {
    return null;
  }

  const preferredKeys = [
    "reply",
    "text",
    "message",
    "content",
    "output_text",
    "assistant",
    "answer",
    "final",
  ];

  for (const key of preferredKeys) {
    if (key in objectValue) {
      const found = findFirstHumanString(objectValue[key], key);
      if (found) {
        return found;
      }
    }
  }

  for (const key of Object.keys(objectValue)) {
    if (METADATA_OBJECT_KEYS.has(key)) {
      continue;
    }
    const found = findFirstHumanString(objectValue[key], key);
    if (found) {
      return found;
    }
  }

  return null;
}

export function extractOpenClawText(value: unknown): string | null {
  const payloadPaths = [
    ["result", "payloads"],
    ["payloads"],
  ];

  for (const path of payloadPaths) {
    const text = extractPayloadText(getByPath(value, path));
    if (text) {
      return text;
    }
  }

  const directTextPaths = [
    ["result", "reply"],
    ["result", "text"],
    ["result", "message"],
    ["result", "content"],
    ["result", "output_text"],
    ["reply"],
    ["text"],
    ["message"],
    ["content"],
    ["output_text"],
  ];

  for (const path of directTextPaths) {
    const candidate = getByPath(value, path);
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return findFirstHumanString(value);
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
      extractOpenClawText(parsed) ?? "No pude extraer una respuesta legible desde OpenClaw.";

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
