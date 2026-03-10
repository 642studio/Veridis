# VERIDIS Console Bridge

Puente de voz + vision para VERIDIS Console.

## Objetivo

- Escuchar microfono en tiempo real (OpenAI Realtime).
- Detectar wake-word por transcripcion (`WAKE_PHRASE`).
- Capturar snapshots de webcam por turno.
- Resumir vision para contexto conversacional.
- Delegar respuesta final a OpenClaw.
- Hablar respuesta con voz de OpenAI Realtime.
- Limpiar snapshots por defecto para no acumular archivos en 24/7.
- Emitir eventos clave a VERIDIS Core (`POST /events`).

## Arquitectura MVP

`mic -> realtime transcript -> wakeword -> snapshots -> vision summary -> openclaw -> realtime tts -> speaker`

Estados del orquestador:

`idle -> armed -> listening -> thinking -> speaking -> cooldown`

## Endpoints HTTP

- `GET /health`
- `GET /status`
- `GET /dashboard` (UI experimental)
- `GET /dashboard/data` (JSON para UI)
- `POST /control/mute`
- `POST /control/unmute`
- `POST /control/test-turn` (payload: `{ "utterance": "..." }`)

## Eventos enviados al Core

- `console.session.started`
- `console.wakeword.detected`
- `console.vision.summary`
- `console.turn.completed`
- `console.turn.failed`

## Configuracion

Copia `.env.example` a `.env`.

Variables principales:

- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL`
- `OPENAI_REALTIME_VOICE`
- `OPENAI_REALTIME_TRANSCRIBE_LANGUAGE` (`es` recomendado)
- `WAKE_PHRASE`
- `KEEP_SNAPSHOTS` (`false` recomendado para 24/7)
- `CAMERA_DEVICE`
- `MIC_DEVICE`
- `SPEAKER_BACKEND` (`aplay` recomendado en Linux)
- `SPEAKER_DEVICE` (ej. `plughw:CARD=Generic_1,DEV=0`)
- `OPENCLAW_SESSION_KEY`
- `VERIDIS_CORE_URL`

## Deteccion de dispositivos Linux

Lista camaras y dispositivos de audio disponibles:

```bash
npm run devices
```

## Desarrollo

```bash
cd console-bridge
npm install
npm run dev
```

## Build + run

```bash
cd console-bridge
npm install
npm run build
npm start
```

## Doctor (preflight)

Valida:

- binarios (`ffmpeg`, `ffplay`, `openclaw`)
- salida de audio de speaker segun backend (`aplay`/`ffplay`)
- dispositivo de camara (v4l2)
- salud de VERIDIS Core
- estado de OpenClaw Gateway
- handshake a OpenAI Realtime

```bash
npm run doctor
```

## Prueba segura en servidor (camara + micro)

1. Lista dispositivos y ajusta `.env`:

```bash
npm run devices
```

Tip Linux: si no se escucha audio, usa `aplay -l` y configura `SPEAKER_DEVICE` a una salida concreta (por ejemplo `plughw:CARD=Generic_1,DEV=0` para analogo).

2. Ejecuta preflight:

```bash
npm run doctor
```

3. Arranca bridge:

```bash
npm run dev
```

4. Verifica estado:

```bash
curl -s http://127.0.0.1:3400/status
```

UI experimental:

```bash
xdg-open http://127.0.0.1:3400/dashboard
```

5. Prueba pipeline completo sin wake-word (manual):

```bash
curl -s -X POST http://127.0.0.1:3400/control/test-turn \
  -H 'Content-Type: application/json' \
  -d '{"utterance":"dame el estado del sistema"}'
```

Tambien puedes usar helper:

```bash
npm run smoke:manual -- "dame el estado del sistema"
```

6. Luego prueba por voz real con frase de activacion configurada en `WAKE_PHRASE`.

## Tests

```bash
npm test
```

Cobertura incluida:

- unit: wakeword detector
- unit: prompt builder
- unit: transiciones principales de estado del orquestador
- integration: reconnect del Realtime client
- integration: degradacion por camara y fallo de OpenClaw

## Deploy Linux (systemd)

1. Copiar proyecto a `/opt/veridis/console-bridge`.
2. Instalar dependencias y compilar.
3. Copiar `deploy/veridis-console-bridge.service` a `/etc/systemd/system/`.
4. Ajustar `User`, rutas y `.env`.
5. Habilitar servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now veridis-console-bridge
sudo systemctl status veridis-console-bridge
```
