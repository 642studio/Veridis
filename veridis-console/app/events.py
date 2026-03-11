from __future__ import annotations

from datetime import datetime

from textual.widgets import RichLog


class EventLogWidget(RichLog):
    """Scrolling event log widget."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, wrap=True, markup=False, highlight=False, **kwargs)

    def push_event(self, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.write(f"[{timestamp}] {message}")
