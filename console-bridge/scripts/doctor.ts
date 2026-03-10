import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

import WebSocket from "ws";

import { loadConfig } from "../src/config.js";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", [command], { stdio: ["ignore", "ignore", "ignore"] });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function runCommand(command: string, args: string[], timeoutMs = 8000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", () => {
      clearTimeout(timeout);
      resolve({ code: 1, stderr: "failed to spawn command" });
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

async function checkRealtime(config: ReturnType<typeof loadConfig>): Promise<CheckResult> {
  if (!config.OPENAI_API_KEY) {
    return {
      name: "openai-realtime",
      ok: false,
      detail: "OPENAI_API_KEY not configured",
    };
  }

  const url = `${config.OPENAI_REALTIME_URL}?model=${encodeURIComponent(config.OPENAI_REALTIME_MODEL)}`;

  return new Promise((resolve) => {
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    const timeout = setTimeout(() => {
      ws.close();
      resolve({
        name: "openai-realtime",
        ok: false,
        detail: "Timed out connecting to Realtime WebSocket",
      });
    }, 8000);

    ws.on("open", () => {
      clearTimeout(timeout);
      ws.close();
      resolve({
        name: "openai-realtime",
        ok: true,
        detail: "Realtime WebSocket handshake successful",
      });
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        name: "openai-realtime",
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

async function main(): Promise<void> {
  const config = loadConfig({ allowMissingSecrets: true });
  const checks: CheckResult[] = [];
  const platform = process.platform;

  checks.push({
    name: "ffmpeg",
    ok: await commandExists("ffmpeg"),
    detail: "Required for mic/camera capture",
  });

  checks.push({
    name: "ffplay",
    ok: await commandExists("ffplay"),
    detail: "Required for speaker playback",
  });

  checks.push({
    name: "openclaw-cli",
    ok: await commandExists(config.OPENCLAW_CLI),
    detail: `Expected command: ${config.OPENCLAW_CLI}`,
  });

  const hasFfmpeg = checks.find((check) => check.name === "ffmpeg")?.ok ?? false;
  const hasFfplay = checks.find((check) => check.name === "ffplay")?.ok ?? false;

  if (hasFfplay && platform === "linux") {
    const speakerProbe = await runCommand("ffplay", [
      "-nodisp",
      "-autoexit",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${config.SPEAKER_SAMPLE_RATE}:cl=mono`,
      "-t",
      "0.2",
    ]);
    checks.push({
      name: "speaker-probe",
      ok: speakerProbe.code === 0,
      detail:
        speakerProbe.code === 0
          ? `Speaker playback opened at ${config.SPEAKER_SAMPLE_RATE}Hz`
          : speakerProbe.stderr.trim() || "Failed to open speaker playback",
    });
  } else if (hasFfplay) {
    checks.push({
      name: "speaker-probe",
      ok: true,
      detail: `Skipped on platform ${platform}; run on Linux target host`,
    });
  }

  if (config.CAMERA_FORMAT === "v4l2" && platform === "linux") {
    try {
      await access(config.CAMERA_DEVICE);
      checks.push({
        name: "camera-device",
        ok: true,
        detail: `Found ${config.CAMERA_DEVICE}`,
      });
    } catch {
      checks.push({
        name: "camera-device",
        ok: false,
        detail: `Missing ${config.CAMERA_DEVICE}`,
      });
    }
  } else if (config.CAMERA_FORMAT === "v4l2") {
    checks.push({
      name: "camera-device",
      ok: true,
      detail: `Skipped on platform ${platform} for v4l2 device checks`,
    });
  }

  if (hasFfmpeg) {
    const linuxOnlyMic = config.MIC_INPUT_FORMAT === "alsa" || config.MIC_INPUT_FORMAT === "pulse";
    if (linuxOnlyMic && platform !== "linux") {
      checks.push({
        name: "microphone-probe",
        ok: true,
        detail: `Skipped on platform ${platform} for ${config.MIC_INPUT_FORMAT} input`,
      });
    } else {
      const micProbe = await runCommand("ffmpeg", [
        "-loglevel",
        "error",
        "-f",
        config.MIC_INPUT_FORMAT,
        "-i",
        config.MIC_DEVICE,
        "-t",
        "1",
        "-f",
        "null",
        "-",
      ]);
      checks.push({
        name: "microphone-probe",
        ok: micProbe.code === 0,
        detail:
          micProbe.code === 0
            ? `Mic stream opened (${config.MIC_INPUT_FORMAT}:${config.MIC_DEVICE})`
            : micProbe.stderr.trim() || "Failed to open microphone stream",
      });
    }

    const linuxOnlyCamera = config.CAMERA_FORMAT === "v4l2";
    if (linuxOnlyCamera && platform !== "linux") {
      checks.push({
        name: "camera-probe",
        ok: true,
        detail: `Skipped on platform ${platform} for ${config.CAMERA_FORMAT} input`,
      });
    } else {
      const cameraProbe = await runCommand("ffmpeg", [
        "-loglevel",
        "error",
        "-f",
        config.CAMERA_FORMAT,
        "-i",
        config.CAMERA_DEVICE,
        "-frames:v",
        "1",
        "-f",
        "null",
        "-",
      ]);
      checks.push({
        name: "camera-probe",
        ok: cameraProbe.code === 0,
        detail:
          cameraProbe.code === 0
            ? `Camera stream opened (${config.CAMERA_FORMAT}:${config.CAMERA_DEVICE})`
            : cameraProbe.stderr.trim() || "Failed to open camera stream",
      });
    }
  }

  try {
    const response = await fetch(`${config.VERIDIS_CORE_URL}/health`);
    checks.push({
      name: "veridis-core",
      ok: response.ok,
      detail: `GET /health => ${response.status}`,
    });
  } catch (error) {
    checks.push({
      name: "veridis-core",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const openclawStatus = await runCommand(config.OPENCLAW_CLI, ["gateway", "status"]);
  checks.push({
    name: "openclaw-gateway",
    ok: openclawStatus.code === 0,
    detail:
      openclawStatus.code === 0
        ? "gateway status command succeeded"
        : openclawStatus.stderr.trim() || "gateway status command failed",
  });

  checks.push(await checkRealtime(config));

  for (const check of checks) {
    const icon = check.ok ? "[OK]" : "[FAIL]";
    console.log(`${icon} ${check.name}: ${check.detail}`);
  }

  const hasFailure = checks.some((check) => !check.ok);
  if (hasFailure) {
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
