from __future__ import annotations

import os
from datetime import datetime

import psutil
from rich.panel import Panel
from rich.table import Table
from textual.widgets import Static


class MetricsWidget(Static):
    """Non-blocking system metrics panel."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._process = psutil.Process()
        self._boot_time = datetime.fromtimestamp(psutil.boot_time())

    def on_mount(self) -> None:
        psutil.cpu_percent(interval=None)
        self.set_interval(1.0, self._refresh_metrics)
        self._refresh_metrics()

    def _refresh_metrics(self) -> None:
        cpu_percent = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        process_mem_mb = self._process.memory_info().rss / (1024 * 1024)

        if hasattr(os, "getloadavg"):
            load_1m, load_5m, load_15m = os.getloadavg()
            load_text = f"{load_1m:.2f}  {load_5m:.2f}  {load_15m:.2f}"
        else:
            load_text = "n/a"

        table = Table.grid(padding=(0, 1))
        table.add_column(justify="left", ratio=1)
        table.add_column(justify="right", ratio=1)

        table.add_row("CPU", f"{cpu_percent:5.1f}%")
        table.add_row("RAM", f"{memory.percent:5.1f}% ({memory.used // (1024**2)} MiB)")
        table.add_row("Proc RSS", f"{process_mem_mb:5.1f} MiB")
        table.add_row("Load 1/5/15", load_text)
        table.add_row("Boot", self._boot_time.strftime("%Y-%m-%d %H:%M:%S"))

        self.update(
            Panel(
                table,
                title="System Metrics",
                border_style="#b44bff",
                expand=True,
            )
        )
