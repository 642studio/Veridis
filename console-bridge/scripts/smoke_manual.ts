import { loadConfig } from "../src/config.js";

async function main(): Promise<void> {
  const config = loadConfig({ allowMissingSecrets: true });
  const utterance = process.argv.slice(2).join(" ").trim() || "dame el estado general del sistema";

  let statusResponse: Response;
  try {
    statusResponse = await fetch(`http://127.0.0.1:${config.BRIDGE_PORT}/status`);
  } catch (error) {
    throw new Error(
      `No pude conectar al bridge en http://127.0.0.1:${config.BRIDGE_PORT}. ` +
        `Arrancalo primero con 'npm run dev' o 'npm start'. ` +
        `Detalle: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!statusResponse.ok) {
    throw new Error(`Bridge status failed: ${statusResponse.status}`);
  }

  const status = await statusResponse.json();
  console.log("Bridge status:", JSON.stringify(status, null, 2));

  const turnResponse = await fetch(`http://127.0.0.1:${config.BRIDGE_PORT}/control/test-turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ utterance }),
  });

  const turnResult = await turnResponse.json();
  console.log("Manual turn response:", JSON.stringify(turnResult, null, 2));

  if (!turnResponse.ok) {
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
