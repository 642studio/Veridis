# VERIDIS Console (Avatar)

Terminal UI with procedural ASCII avatar that reacts to live events from VERIDIS Core.

## Features

- Procedural avatar with smooth state transitions.
- Real-time event log from `VERIDIS_CORE_URL`.
- Automatic state mapping from core events:
  - `console.state.changed` -> avatar state (`armed`, `listening`, `thinking`, `speaking`, etc.)
  - `console.turn.failed` or critical events -> `ALERT`
  - `console.turn.completed` -> `IDLE`
- Manual override with keyboard shortcuts (`1`..`0`).

## Quick start

```bash
cd veridis-console
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
VERIDIS_CORE_URL=http://127.0.0.1:3001 python -m app.main
```

## Runtime env

- `VERIDIS_CORE_URL` (default: `http://127.0.0.1:3001`)
- `VERIDIS_CORE_POLL_SECONDS` (default: `0.7`)
- `VERIDIS_CORE_EVENTS_LIMIT` (default: `40`)

## systemd (user)

```bash
mkdir -p ~/.config/systemd/user
cp deploy/veridis-console.service ~/.config/systemd/user/veridis-console.service
systemctl --user daemon-reload
systemctl --user enable --now veridis-console
systemctl --user status veridis-console --no-pager
```
