import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const schema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_REALTIME_MODEL: z.string().default("gpt-realtime"),
  OPENAI_REALTIME_VOICE: z.string().default("alloy"),
  OPENAI_REALTIME_TRANSCRIBE_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  OPENAI_REALTIME_TRANSCRIBE_LANGUAGE: z.string().default("es"),
  OPENAI_REALTIME_URL: z.string().url().default("wss://api.openai.com/v1/realtime"),
  WAKE_PHRASE: z.string().min(1).default("oye veridis"),
  WAKE_COOLDOWN_MS: z.coerce.number().int().positive().default(1500),
  TURN_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(1200),
  KEEP_SNAPSHOTS: z.coerce.boolean().default(false),
  CAMERA_DEVICE: z.string().default("/dev/video0"),
  CAMERA_FORMAT: z.enum(["v4l2", "avfoundation"]).default("v4l2"),
  MIC_DEVICE: z.string().default("default"),
  MIC_INPUT_FORMAT: z.enum(["alsa", "pulse", "avfoundation"]).default("alsa"),
  SPEAKER_BACKEND: z.enum(["ffplay", "aplay"]).default(process.platform === "linux" ? "aplay" : "ffplay"),
  SPEAKER_DEVICE: z.string().default("default"),
  SPEAKER_SAMPLE_RATE: z.coerce.number().int().positive().default(24000),
  OPENCLAW_CLI: z.string().default("openclaw"),
  OPENCLAW_AGENT_ID: z.string().default("main"),
  OPENCLAW_SESSION_KEY: z.string().default("agent:main:main"),
  OPENCLAW_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  VERIDIS_CORE_URL: z.string().url().default("http://127.0.0.1:3001"),
  BRIDGE_PORT: z.coerce.number().int().positive().default(3400),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type BridgeConfig = z.infer<typeof schema>;

export function loadConfig(options?: { allowMissingSecrets?: boolean }): BridgeConfig {
  const parsed = schema.parse(process.env);
  if (!options?.allowMissingSecrets && !parsed.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return parsed;
}
