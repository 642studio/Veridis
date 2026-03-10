import { loadConfig } from "./config.js";
import { BridgeApiServer } from "./api/server.js";
import { MicrophoneCapture, SpeakerPlayback } from "./audio/audio_capture.js";
import { CameraCapture } from "./camera/camera_capture.js";
import { CoreEventsClient } from "./core/core_events.js";
import { OpenClawAdapter } from "./openclaw/openclaw_adapter.js";
import { BridgeOrchestrator } from "./orchestrator/orchestrator.js";
import { RealtimeClient } from "./realtime/realtime_client.js";
import { createLogger } from "./util/logger.js";
import { VisionSummarizer } from "./vision/vision_summarizer.js";
import { WakewordDetector } from "./wakeword/wakeword_detector.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);

  const microphone = new MicrophoneCapture({
    inputFormat: config.MIC_INPUT_FORMAT,
    inputDevice: config.MIC_DEVICE,
    sampleRate: 16000,
    channels: 1,
  });

  const speaker = new SpeakerPlayback({
    sampleRate: config.SPEAKER_SAMPLE_RATE,
    channels: 1,
  });

  const realtimeClient = new RealtimeClient({
    apiKey: config.OPENAI_API_KEY ?? "",
    baseUrl: config.OPENAI_REALTIME_URL,
    model: config.OPENAI_REALTIME_MODEL,
    voice: config.OPENAI_REALTIME_VOICE,
    transcribeModel: config.OPENAI_REALTIME_TRANSCRIBE_MODEL,
    logger,
  });

  const cameraCapture = new CameraCapture({
    device: config.CAMERA_DEVICE,
    format: config.CAMERA_FORMAT,
  });

  const visionSummarizer = new VisionSummarizer({
    apiKey: config.OPENAI_API_KEY,
    logger,
  });

  const openClaw = new OpenClawAdapter({
    cliPath: config.OPENCLAW_CLI,
    agentId: config.OPENCLAW_AGENT_ID,
    sessionKey: config.OPENCLAW_SESSION_KEY,
    timeoutMs: config.OPENCLAW_TIMEOUT_MS,
    logger,
  });

  const coreEvents = new CoreEventsClient({
    coreUrl: config.VERIDIS_CORE_URL,
    logger,
  });

  const wakewordDetector = new WakewordDetector(config.WAKE_PHRASE);

  const orchestrator = new BridgeOrchestrator(
    {
      realtimeClient,
      microphone,
      speaker,
      cameraCapture,
      visionSummarizer,
      openClaw,
      coreEvents,
      wakewordDetector,
    },
    {
      wakeCooldownMs: config.WAKE_COOLDOWN_MS,
      turnCooldownMs: config.TURN_COOLDOWN_MS,
      keepSnapshots: config.KEEP_SNAPSHOTS,
      wakePhrase: config.WAKE_PHRASE,
      micDevice: config.MIC_DEVICE,
      cameraDevice: config.CAMERA_DEVICE,
      speakerSampleRate: config.SPEAKER_SAMPLE_RATE,
      logger,
    },
  );

  const apiServer = new BridgeApiServer({
    port: config.BRIDGE_PORT,
    orchestrator,
    logger,
  });

  orchestrator.on("error", (error) => {
    logger.error("Orchestrator emitted error", { error: error.message });
  });

  await orchestrator.start();
  await apiServer.start();

  const shutdown = async () => {
    logger.info("Shutting down bridge");
    await apiServer.stop();
    orchestrator.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
