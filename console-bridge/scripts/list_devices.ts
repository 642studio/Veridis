import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", [command], { stdio: ["ignore", "ignore", "ignore"] });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function runCommand(
  command: string,
  args: string[],
  timeoutMs = 10_000,
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
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
      resolve({
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      });
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      resolve({
        ok: code === 0,
        output,
      });
    });
  });
}

function printSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function listVideoDevicesFromDev(): Promise<string[]> {
  const entries = await readdir("/dev");
  return entries
    .filter((entry) => entry.startsWith("video"))
    .map((entry) => `/dev/${entry}`)
    .sort();
}

async function main(): Promise<void> {
  if (process.platform !== "linux") {
    console.log(`Este script esta orientado a Linux. Plataforma actual: ${process.platform}`);
    process.exit(0);
  }

  printSection("Camaras");
  if (await commandExists("v4l2-ctl")) {
    const result = await runCommand("v4l2-ctl", ["--list-devices"]);
    console.log(result.output || "Sin salida de v4l2-ctl");
  } else {
    console.log("v4l2-ctl no esta instalado; usando /dev/video*");
    try {
      const devices = await listVideoDevicesFromDev();
      if (devices.length === 0) {
        console.log("No se encontraron dispositivos /dev/video*");
      } else {
        for (const device of devices) {
          console.log(device);
        }
      }
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  }

  printSection("Microfonos ALSA");
  if (await commandExists("arecord")) {
    const result = await runCommand("arecord", ["-l"]);
    console.log(result.output || "Sin salida de arecord -l");
  } else {
    console.log("arecord no esta instalado.");
  }

  printSection("PulseAudio/PipeWire Sources");
  if (await commandExists("pactl")) {
    const result = await runCommand("pactl", ["list", "short", "sources"]);
    console.log(result.output || "Sin sources en pactl");
  } else {
    console.log("pactl no esta instalado.");
  }

  printSection("PulseAudio/PipeWire Sinks");
  if (await commandExists("pactl")) {
    const result = await runCommand("pactl", ["list", "short", "sinks"]);
    console.log(result.output || "Sin sinks en pactl");
  } else {
    console.log("pactl no esta instalado.");
  }

  printSection("Siguiente paso recomendado");
  console.log("1) Ajusta CAMERA_DEVICE, MIC_DEVICE y MIC_INPUT_FORMAT en .env.");
  console.log("2) Corre: npm run doctor");
  console.log("3) Arranca bridge: npm run dev");
  console.log("4) Prueba turno manual: npm run smoke:manual -- \"estado del sistema\"");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
