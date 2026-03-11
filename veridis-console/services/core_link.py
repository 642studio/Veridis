from __future__ import annotations

import asyncio
import json
import os
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from app.states import AvatarState, normalize_state


@dataclass(slots=True)
class CoreEvent:
    type: str
    source: str
    level: str
    message: str
    timestamp: str
    payload: Any
    suggested_state: str


class CoreLink:
    """Poll VERIDIS Core and expose events/states through async queues."""

    def __init__(self) -> None:
        self.core_url = os.getenv("VERIDIS_CORE_URL", "http://127.0.0.1:3001").rstrip("/")
        self.poll_interval = max(0.2, float(os.getenv("VERIDIS_CORE_POLL_SECONDS", "0.7")))
        self.events_limit = max(5, min(200, int(os.getenv("VERIDIS_CORE_EVENTS_LIMIT", "40"))))

        self._state_queue: asyncio.Queue[str] = asyncio.Queue()
        self._event_queue: asyncio.Queue[CoreEvent] = asyncio.Queue()
        self._seen_keys: set[str] = set()
        self._seen_order: deque[str] = deque(maxlen=1200)
        self._poll_task: asyncio.Task[None] | None = None
        self._connected = False
        self._last_error: str | None = None

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def last_error(self) -> str | None:
        return self._last_error

    def start(self) -> None:
        if self._poll_task is not None:
            return
        self._poll_task = asyncio.create_task(self._poll_loop(), name="core-link-poll")

    async def stop(self) -> None:
        if self._poll_task is None:
            return
        self._poll_task.cancel()
        try:
            await self._poll_task
        except asyncio.CancelledError:
            pass
        self._poll_task = None

    async def publish_state(self, state: str | AvatarState) -> None:
        normalized = normalize_state(state)
        if normalized == AvatarState.TRANSITION:
            return
        await self._state_queue.put(normalized.value)

    async def next_state(self, timeout: float = 0.0) -> str | None:
        try:
            if timeout <= 0:
                return self._state_queue.get_nowait()
            return await asyncio.wait_for(self._state_queue.get(), timeout=timeout)
        except (asyncio.QueueEmpty, asyncio.TimeoutError):
            return None

    async def next_event(self, timeout: float = 0.0) -> CoreEvent | None:
        try:
            if timeout <= 0:
                return self._event_queue.get_nowait()
            return await asyncio.wait_for(self._event_queue.get(), timeout=timeout)
        except (asyncio.QueueEmpty, asyncio.TimeoutError):
            return None

    async def _poll_loop(self) -> None:
        while True:
            try:
                events = await asyncio.to_thread(self._fetch_events_once)
                if events:
                    self._connected = True
                    self._last_error = None
                    for event in events:
                        key = self._event_key(event)
                        if key in self._seen_keys:
                            continue
                        self._remember_key(key)
                        await self._event_queue.put(event)
                        if event.suggested_state:
                            await self._state_queue.put(event.suggested_state)
            except Exception as error:  # noqa: BLE001
                self._connected = False
                self._last_error = str(error)
            await asyncio.sleep(self.poll_interval)

    def _remember_key(self, key: str) -> None:
        if len(self._seen_order) == self._seen_order.maxlen:
            old_key = self._seen_order.popleft()
            self._seen_keys.discard(old_key)
        self._seen_order.append(key)
        self._seen_keys.add(key)

    def _event_key(self, event: CoreEvent) -> str:
        return f"{event.timestamp}|{event.source}|{event.type}|{event.message}"

    def _fetch_events_once(self) -> list[CoreEvent]:
        events_payload = self._request_json(
            f"{self.core_url}/events?{urlencode({'limit': self.events_limit})}"
        )

        if isinstance(events_payload, dict) and isinstance(events_payload.get("events"), list):
            raw_events = events_payload["events"]
            normalized = [self._normalize_event(item) for item in reversed(raw_events)]
            return [event for event in normalized if event is not None]

        state_payload = self._request_json(f"{self.core_url}/state")
        if isinstance(state_payload, dict) and isinstance(state_payload.get("lastEvent"), dict):
            fallback = self._normalize_event(state_payload.get("lastEvent"))
            if fallback is not None:
                return [fallback]

        return []

    def _request_json(self, url: str) -> Any:
        try:
            with urlopen(url, timeout=4) as response:  # noqa: S310
                body = response.read().decode("utf-8")
                return json.loads(body)
        except HTTPError as error:
            if error.code == 404 and url.endswith("/events?limit=" + str(self.events_limit)):
                return None
            raise RuntimeError(f"Core HTTP {error.code} at {url}") from error
        except URLError as error:
            raise RuntimeError(f"Core unreachable at {url}: {error.reason}") from error
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Invalid JSON from core at {url}") from error

    def _normalize_event(self, raw: Any) -> CoreEvent | None:
        if not isinstance(raw, dict):
            return None

        event_type = str(raw.get("type") or "unknown")
        source = str(raw.get("source") or "unknown")
        level = str(raw.get("level") or "info")
        message = str(raw.get("message") or "Event received")
        timestamp = self._normalize_timestamp(raw.get("timestamp"))
        payload = raw.get("payload")

        return CoreEvent(
            type=event_type,
            source=source,
            level=level,
            message=message,
            timestamp=timestamp,
            payload=payload,
            suggested_state=self._state_from_event(event_type, level, payload),
        )

    def _normalize_timestamp(self, value: Any) -> str:
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed.isoformat()
            except ValueError:
                pass
        return datetime.utcnow().isoformat()

    def _state_from_event(self, event_type: str, level: str, payload: Any) -> str:
        if event_type == "console.state.changed" and isinstance(payload, dict):
            raw_state = str(payload.get("state") or "").strip().lower()
            return {
                "idle": "IDLE",
                "armed": "BREATH",
                "listening": "FOCUS",
                "thinking": "PROCESSING",
                "speaking": "HAND",
                "cooldown": "BREATH",
            }.get(raw_state, "IDLE")

        if event_type == "console.wakeword.detected":
            return "FOCUS"
        if event_type == "console.vision.summary":
            return "PROCESSING"
        if event_type == "console.turn.completed":
            return "IDLE"
        if event_type == "console.turn.failed":
            return "ALERT"

        if level == "critical":
            return "ALERT"
        if level == "warning":
            return "PROCESSING"
        return "BREATH"
