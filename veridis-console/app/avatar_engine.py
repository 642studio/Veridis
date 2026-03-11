from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter

import numpy as np

from app.states import AvatarState, generate_density, normalize_state


@dataclass(slots=True)
class FrameResult:
    lines: list[str]
    changed: bool
    visible_state: str


class AvatarEngine:
    """Procedural ASCII avatar renderer with smooth state morphing."""

    def __init__(
        self,
        ascii_ramp: str = " .:-=+*#%@",
        max_fps: int = 30,
        transition_seconds: float = 1.2,
    ) -> None:
        self._ascii = np.array(list(ascii_ramp))
        self.max_fps = max(1, min(max_fps, 30))
        self.transition_seconds = max(0.1, transition_seconds)

        self._state = AvatarState.IDLE
        self._target_state = AvatarState.IDLE
        self._requested_state: AvatarState | None = None

        self._transition_start = 0.0
        self._frozen_source_density: np.ndarray | None = None

        self._grid_width = 0
        self._grid_height = 0
        self._x: np.ndarray | None = None
        self._y: np.ndarray | None = None

        self._char_buffer: np.ndarray | None = None
        self._previous_buffer: np.ndarray | None = None
        self._last_density: np.ndarray | None = None
        self._last_lines: list[str] = []

    @property
    def state(self) -> str:
        if self._frozen_source_density is not None:
            return AvatarState.TRANSITION.value
        return self._state.value

    @property
    def target_state(self) -> str:
        return self._target_state.value

    def frame_interval_seconds(self) -> float:
        fps_by_state = {
            AvatarState.IDLE.value: 12,
            AvatarState.BREATH.value: 14,
            AvatarState.FOCUS.value: 22,
            AvatarState.PROCESSING.value: 28,
            AvatarState.ALERT.value: 30,
            AvatarState.HAND.value: 24,
            AvatarState.SPECTER.value: 20,
            AvatarState.TUNNEL.value: 30,
            AvatarState.HALFTONE.value: 18,
            AvatarState.BOOT.value: 24,
            AvatarState.TRANSITION.value: 30,
        }
        effective_fps = min(self.max_fps, fps_by_state.get(self.state, self.max_fps))
        return 1.0 / max(1, effective_fps)

    def set_state(self, state_name: str | AvatarState) -> None:
        state = normalize_state(state_name)
        if state == AvatarState.TRANSITION:
            return
        if state == self._target_state and self._frozen_source_density is None:
            return
        self._requested_state = state

    def render_frame(
        self,
        width: int,
        height: int,
        now: float | None = None,
    ) -> FrameResult:
        if width < 2 or height < 2:
            return FrameResult(lines=[""], changed=False, visible_state=self.state)

        now = perf_counter() if now is None else now
        self._ensure_grid(width, height)

        if self._requested_state is not None and self._requested_state != self._target_state:
            if self._last_density is not None and self._last_density.shape == (height, width):
                self._frozen_source_density = self._last_density.copy()
            else:
                self._frozen_source_density = self._density_for_state(self._target_state, now)
            self._target_state = self._requested_state
            self._requested_state = None
            self._transition_start = now

        target_density = self._density_for_state(self._target_state, now)
        composed_density = target_density

        if self._frozen_source_density is not None:
            raw_alpha = (now - self._transition_start) / self.transition_seconds
            alpha = float(np.clip(raw_alpha, 0.0, 1.0))
            smooth_alpha = self._smoothstep(alpha)
            composed_density = (1.0 - smooth_alpha) * self._frozen_source_density + smooth_alpha * target_density
            if alpha >= 1.0:
                self._state = self._target_state
                self._frozen_source_density = None
        else:
            self._state = self._target_state

        self._last_density = composed_density.astype(np.float32, copy=False)
        chars = self._density_to_chars(self._last_density)

        changed = not (
            self._previous_buffer is not None
            and self._previous_buffer.shape == chars.shape
            and np.array_equal(self._previous_buffer, chars)
        )
        if changed:
            self._char_buffer = chars
            self._previous_buffer = chars.copy()
            self._last_lines = ["".join(row.tolist()) for row in chars]

        return FrameResult(lines=self._last_lines, changed=changed, visible_state=self.state)

    def _ensure_grid(self, width: int, height: int) -> None:
        if self._x is not None and self._y is not None and width == self._grid_width and height == self._grid_height:
            return

        self._grid_width = width
        self._grid_height = height

        x = np.linspace(-1.0, 1.0, width, dtype=np.float32)
        y = np.linspace(-1.0, 1.0, height, dtype=np.float32)
        xv, yv = np.meshgrid(x, y)

        # Terminal cells are usually taller than they are wide. This factor helps
        # circles look circular instead of stretched.
        aspect = (width / max(height, 1)) * 0.55
        self._x = xv * aspect
        self._y = yv

        self._char_buffer = np.zeros((height, width), dtype="<U1")
        self._previous_buffer = None
        self._last_lines = []
        self._last_density = None

    def _density_for_state(self, state: AvatarState, now: float) -> np.ndarray:
        assert self._x is not None
        assert self._y is not None
        return generate_density(state, self._x, self._y, now)

    def _density_to_chars(self, density: np.ndarray) -> np.ndarray:
        compressed = np.tanh(density * 1.25)
        normalized = (compressed + 1.0) * 0.5
        indices = np.clip(
            (normalized * (len(self._ascii) - 1)).astype(np.int16),
            0,
            len(self._ascii) - 1,
        )
        return self._ascii[indices]

    @staticmethod
    def _smoothstep(alpha: float) -> float:
        return alpha * alpha * (3.0 - 2.0 * alpha)
