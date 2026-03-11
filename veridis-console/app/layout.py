from __future__ import annotations

import asyncio
import contextlib
from time import perf_counter

from rich.text import Text
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Static

from app.avatar_engine import AvatarEngine
from app.events import EventLogWidget
from app.metrics import MetricsWidget
from services.core_link import CoreEvent, CoreLink


class AvatarWidget(Static):
    """High-frequency ASCII avatar surface."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.engine = AvatarEngine(max_fps=30, transition_seconds=1.1)
        self._animation_task: asyncio.Task[None] | None = None
        self._state_colors = {
            "IDLE": "#7c31dd",
            "BREATH": "#8c3ff0",
            "FOCUS": "#9a4ff7",
            "PROCESSING": "#6f2ce0",
            "ALERT": "#b24dff",
            "HAND": "#8850e8",
            "SPECTER": "#9b5bf2",
            "TUNNEL": "#7330d6",
            "HALFTONE": "#8250df",
            "BOOT": "#a16af5",
            "TRANSITION": "#a55df2",
        }
        self._wave_anchors = (
            (108, 7, 255),
            (131, 48, 224),
            (156, 86, 246),
            (126, 41, 214),
        )
        self._current_rgb = self._hex_to_rgb(self._state_colors["IDLE"])

    def on_mount(self) -> None:
        self._animation_task = asyncio.create_task(self._animation_loop(), name="avatar-animation")

    async def on_unmount(self) -> None:
        if self._animation_task is not None:
            self._animation_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._animation_task

    def set_state(self, state_name: str) -> None:
        self.engine.set_state(state_name)

    async def _animation_loop(self) -> None:
        while True:
            frame_start = perf_counter()

            width = max(self.content_size.width, 2)
            height = max(self.content_size.height, 2)
            frame = self.engine.render_frame(width=width, height=height, now=frame_start)

            if frame.changed:
                base_hex = self._state_colors.get(frame.visible_state, self._state_colors["IDLE"])
                base_rgb = self._hex_to_rgb(base_hex)
                wave_rgb = self._wave_color(frame_start)
                target_rgb = self._mix_rgb(base_rgb, wave_rgb, 0.34)
                self._current_rgb = self._mix_rgb(self._current_rgb, target_rgb, 0.14)
                avatar_color = self._rgb_to_hex(self._current_rgb)
                avatar_text = Text("\n".join(frame.lines), style=f"bold {avatar_color}")
                self.update(avatar_text)

            elapsed = perf_counter() - frame_start
            frame_time = self.engine.frame_interval_seconds()
            await asyncio.sleep(max(0.001, frame_time - elapsed))

    @staticmethod
    def _hex_to_rgb(value: str) -> tuple[int, int, int]:
        hex_value = value.lstrip("#")
        return (
            int(hex_value[0:2], 16),
            int(hex_value[2:4], 16),
            int(hex_value[4:6], 16),
        )

    @staticmethod
    def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
        r, g, b = rgb
        return f"#{r:02x}{g:02x}{b:02x}"

    @staticmethod
    def _mix_rgb(a: tuple[int, int, int], b: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
        inv = 1.0 - alpha
        return (
            int(max(0, min(255, round(a[0] * inv + b[0] * alpha)))),
            int(max(0, min(255, round(a[1] * inv + b[1] * alpha)))),
            int(max(0, min(255, round(a[2] * inv + b[2] * alpha)))),
        )

    def _wave_color(self, now: float) -> tuple[int, int, int]:
        phase = (now * 0.16) % len(self._wave_anchors)
        i = int(phase)
        alpha = phase - i
        a = self._wave_anchors[i]
        b = self._wave_anchors[(i + 1) % len(self._wave_anchors)]
        return self._mix_rgb(a, b, alpha)


class VeridisConsoleApp(App[None]):
    CSS = """
    Screen {
        layout: horizontal;
        background: black;
        color: #f8f5ff;
    }

    #left-pane {
        width: 2fr;
        border: heavy #7b2cff;
        padding: 0 1;
    }

    #right-pane {
        width: 1fr;
        layout: vertical;
        padding-left: 1;
    }

    #metrics-pane {
        height: 11;
        border: round #7b2cff;
        margin-bottom: 1;
        padding: 0 1;
    }

    #events-pane {
        height: 1fr;
        border: round #7b2cff;
        padding: 0 1;
    }

    AvatarWidget {
        width: 1fr;
        height: 1fr;
        content-align: center middle;
    }
    """

    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("1", "state_idle", "Idle"),
        Binding("2", "state_breath", "Breath"),
        Binding("3", "state_focus", "Focus"),
        Binding("4", "state_processing", "Processing"),
        Binding("5", "state_alert", "Alert"),
        Binding("6", "state_hand", "Hand"),
        Binding("7", "state_specter", "Specter"),
        Binding("8", "state_tunnel", "Tunnel"),
        Binding("9", "state_halftone", "Halftone"),
        Binding("0", "state_boot", "Boot"),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.core_link = CoreLink()
        self.avatar = AvatarWidget(id="avatar")
        self.metrics = MetricsWidget(id="metrics")
        self.events = EventLogWidget(id="events", max_lines=400, auto_scroll=True)
        self._core_task: asyncio.Task[None] | None = None
        self._manual_hold_until = 0.0

    def compose(self) -> ComposeResult:
        with Horizontal():
            with Container(id="left-pane"):
                yield self.avatar
            with Vertical(id="right-pane"):
                with Container(id="metrics-pane"):
                    yield self.metrics
                with Container(id="events-pane"):
                    yield self.events

    def on_mount(self) -> None:
        self.title = "VERIDIS Console"
        self.sub_title = "1-0: mode control  |  core events active  |  q: quit"
        self.avatar.set_state("BREATH")
        self.events.push_event("VERIDIS console online.")
        self.events.push_event(f"Core endpoint: {self.core_link.core_url}")
        self.core_link.start()
        self._core_task = asyncio.create_task(self._core_event_listener(), name="core-event-listener")

    async def on_unmount(self) -> None:
        if self._core_task is not None:
            self._core_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._core_task
        await self.core_link.stop()

    async def _core_event_listener(self) -> None:
        while True:
            event = await self.core_link.next_event(timeout=0.5)
            if event is None:
                continue

            self.events.push_event(self._format_event_line(event))
            if perf_counter() >= self._manual_hold_until:
                self.avatar.set_state(event.suggested_state)

    def _format_event_line(self, event: CoreEvent) -> str:
        timestamp = event.timestamp.replace("T", " ").replace("Z", "")
        return (
            f"{timestamp} | {event.source}:{event.type} "
            f"[{event.level}] -> {event.suggested_state} | {event.message}"
        )

    def _set_state(self, state: str) -> None:
        self.avatar.set_state(state)
        # Keep manual mode visible for inspection before auto-cycle takes over.
        self._manual_hold_until = perf_counter() + 14.0
        self.events.push_event(f"Manual state set: {state}")

    def action_state_idle(self) -> None:
        self._set_state("IDLE")

    def action_state_breath(self) -> None:
        self._set_state("BREATH")

    def action_state_focus(self) -> None:
        self._set_state("FOCUS")

    def action_state_processing(self) -> None:
        self._set_state("PROCESSING")

    def action_state_alert(self) -> None:
        self._set_state("ALERT")

    def action_state_hand(self) -> None:
        self._set_state("HAND")

    def action_state_specter(self) -> None:
        self._set_state("SPECTER")

    def action_state_tunnel(self) -> None:
        self._set_state("TUNNEL")

    def action_state_halftone(self) -> None:
        self._set_state("HALFTONE")

    def action_state_boot(self) -> None:
        self._set_state("BOOT")
