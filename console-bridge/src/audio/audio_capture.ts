import { EventEmitter } from "node:events";
import { ChildProcess, spawn } from "node:child_process";

export interface MicrophoneCaptureOptions {
  inputFormat: "alsa" | "pulse" | "avfoundation";
  inputDevice: string;
  sampleRate: number;
  channels: number;
}

interface MicrophoneCaptureEvents {
  audio: [Buffer];
  error: [Error];
  start: [];
  stop: [];
}

export class MicrophoneCapture extends EventEmitter<MicrophoneCaptureEvents> {
  private process: ChildProcess | null = null;

  constructor(private readonly options: MicrophoneCaptureOptions) {
    super();
  }

  public start(): void {
    if (this.process) {
      return;
    }

    const args = [
      "-loglevel",
      "error",
      "-f",
      this.options.inputFormat,
      "-i",
      this.options.inputDevice,
      "-ac",
      String(this.options.channels),
      "-ar",
      String(this.options.sampleRate),
      "-f",
      "s16le",
      "-acodec",
      "pcm_s16le",
      "pipe:1",
    ];

    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      this.emit("audio", chunk);
    });

    child.stderr?.on("data", (data: Buffer) => {
      this.emit("error", new Error(data.toString("utf8").trim()));
    });

    child.on("error", (error) => {
      this.emit("error", error);
    });

    child.on("exit", () => {
      this.process = null;
      this.emit("stop");
    });

    this.process = child;
    this.emit("start");
  }

  public stop(): void {
    if (!this.process) {
      return;
    }
    this.process.kill("SIGTERM");
    this.process = null;
  }

  public isRunning(): boolean {
    return this.process !== null;
  }
}

export interface SpeakerPlaybackOptions {
  sampleRate: number;
  channels: number;
}

export class SpeakerPlayback {
  private process: ChildProcess | null = null;

  constructor(private readonly options: SpeakerPlaybackOptions) {}

  public beginStream(): void {
    if (this.process) {
      return;
    }

    const args = [
      "-nodisp",
      "-autoexit",
      "-loglevel",
      "error",
      "-f",
      "s16le",
      "-ar",
      String(this.options.sampleRate),
      "-ac",
      String(this.options.channels),
      "-",
    ];

    this.process = spawn("ffplay", args, {
      stdio: ["pipe", "ignore", "pipe"],
    });

    this.process.on("exit", () => {
      this.process = null;
    });
  }

  public writeChunk(chunk: Buffer): void {
    if (!this.process) {
      this.beginStream();
    }
    this.process?.stdin?.write(chunk);
  }

  public endStream(): void {
    if (!this.process) {
      return;
    }
    this.process.stdin?.end();
  }

  public stop(): void {
    if (!this.process) {
      return;
    }
    this.process.kill("SIGTERM");
    this.process = null;
  }
}
