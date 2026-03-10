import { spawn } from "node:child_process";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Snapshot } from "../types.js";

export interface CameraCaptureOptions {
  device: string;
  format: "v4l2" | "avfoundation";
  imageDir?: string;
}

export class CameraCapture {
  private readonly directoryPromise: Promise<string>;

  constructor(private readonly options: CameraCaptureOptions) {
    this.directoryPromise = this.resolveOutputDirectory();
  }

  public async capture(source: Snapshot["source"]): Promise<Snapshot> {
    const directory = await this.directoryPromise;
    const timestamp = new Date();
    const fileName = `${timestamp.toISOString().replace(/[:.]/g, "-")}-${source}.jpg`;
    const output = join(directory, fileName);

    const args = [
      "-loglevel",
      "error",
      "-f",
      this.options.format,
      "-i",
      this.options.device,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      output,
    ];

    await this.run("ffmpeg", args);

    return {
      path: output,
      capturedAt: timestamp.toISOString(),
      source,
    };
  }

  private async resolveOutputDirectory(): Promise<string> {
    if (this.options.imageDir) {
      await mkdir(this.options.imageDir, { recursive: true });
      return this.options.imageDir;
    }
    return mkdtemp(join(tmpdir(), "veridis-console-bridge-"));
  }

  private run(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`Command failed (${command} ${args.join(" ")}): ${stderr.trim()}`));
      });
    });
  }
}
