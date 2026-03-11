from __future__ import annotations

from enum import Enum

import numpy as np


class AvatarState(str, Enum):
    IDLE = "IDLE"
    BREATH = "BREATH"
    FOCUS = "FOCUS"
    PROCESSING = "PROCESSING"
    ALERT = "ALERT"
    HAND = "HAND"
    SPECTER = "SPECTER"
    TUNNEL = "TUNNEL"
    HALFTONE = "HALFTONE"
    BOOT = "BOOT"
    TRANSITION = "TRANSITION"


NON_TRANSITION_STATES = (
    AvatarState.IDLE,
    AvatarState.BREATH,
    AvatarState.FOCUS,
    AvatarState.PROCESSING,
    AvatarState.ALERT,
    AvatarState.HAND,
    AvatarState.SPECTER,
    AvatarState.TUNNEL,
    AvatarState.HALFTONE,
    AvatarState.BOOT,
)


def normalize_state(name: str | AvatarState) -> AvatarState:
    if isinstance(name, AvatarState):
        return name
    upper_name = name.strip().upper()
    return AvatarState(upper_name)


def generate_density(
    state: AvatarState,
    x: np.ndarray,
    y: np.ndarray,
    t: float,
) -> np.ndarray:
    if state == AvatarState.IDLE:
        return _idle_density(x, y, t)
    if state == AvatarState.BREATH:
        return _breath_density(x, y, t)
    if state == AvatarState.FOCUS:
        return _focus_density(x, y, t)
    if state == AvatarState.PROCESSING:
        return _processing_density(x, y, t)
    if state == AvatarState.ALERT:
        return _alert_density(x, y, t)
    if state == AvatarState.HAND:
        return _hand_density(x, y, t)
    if state == AvatarState.SPECTER:
        return _specter_density(x, y, t)
    if state == AvatarState.TUNNEL:
        return _tunnel_density(x, y, t)
    if state == AvatarState.HALFTONE:
        return _halftone_density(x, y, t)
    if state == AvatarState.BOOT:
        return _boot_density(x, y, t)
    return np.zeros_like(x, dtype=np.float32)


def _idle_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    radial = np.sqrt((x * 0.82) ** 2 + (y * 1.18) ** 2)
    core = np.exp(-4.9 * radial**2)
    inner_ring = np.exp(-64.0 * (radial - (0.33 + 0.01 * np.sin(0.6 * t))) ** 2)
    outer_ring = np.exp(-44.0 * (radial - (0.67 + 0.015 * np.sin(0.35 * t + 1.3))) ** 2)
    grain = 0.12 * np.cos(12.0 * radial - 0.7 * t)
    ribs = 0.12 * np.cos(9.0 * x) * np.exp(-3.6 * np.abs(y))
    return (0.75 * core + 0.42 * inner_ring + 0.35 * outer_ring + grain + ribs).astype(np.float32)


def _breath_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    breath_scale = 1.0 + 0.08 * np.sin(1.05 * t)
    x_b = x / breath_scale
    y_b = (y + 0.06) / breath_scale

    head = np.exp(-((x_b / 0.18) ** 2 + ((y_b + 0.56) / 0.15) ** 2))
    neck = np.exp(-((x_b / 0.13) ** 2 + ((y_b + 0.36) / 0.08) ** 2))
    torso = np.exp(-((x_b / 0.34) ** 2 + ((y_b + 0.03) / 0.48) ** 2))
    shoulders = np.exp(-((x_b / 0.56) ** 2 + ((y_b + 0.22) / 0.14) ** 2))
    aura = np.exp(-((x_b / 0.72) ** 2 + ((y_b + 0.02) / 0.92) ** 2))

    rain = 0.16 * np.cos(50.0 * x + 1.8 * np.sin(2.2 * t)) * np.exp(-0.9 * (y + 0.15) ** 2)
    spark = 0.12 * np.sin(22.0 * (x + y) + 2.0 * t) * np.exp(-2.1 * (x**2 + y**2))
    return (0.95 * head + 0.65 * neck + 0.82 * torso + 0.54 * shoulders + 0.28 * aura + rain + spark).astype(
        np.float32
    )


def _focus_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    lid_curve = 0.50 - 0.82 * x**2
    lid_distance = np.abs(y) - lid_curve
    eyelid = np.exp(-20.0 * np.clip(lid_distance, 0.0, None))

    iris_radius = np.sqrt((x / 0.72) ** 2 + (y / 0.50) ** 2)
    iris_ring = np.exp(-42.0 * (iris_radius - 0.62) ** 2)
    fibers = 0.20 * np.cos(46.0 * np.arctan2(y, x + 1e-4) + 2.8 * t) * np.exp(-22.0 * (iris_radius - 0.63) ** 2)

    pupil_width = 0.028 + 0.012 * (0.5 + 0.5 * np.sin(1.8 * t))
    vertical_pupil = np.exp(-(x / pupil_width) ** 2) * np.exp(-2.5 * (y / 0.56) ** 2)

    core_glow = np.exp(-7.2 * ((x * 0.72) ** 2 + (y * 1.26) ** 2))
    scanline = 0.11 * np.cos((x + 0.35 * np.sin(0.7 * t)) * 26.0) * np.exp(-20.0 * y**2)
    return (0.56 * eyelid + 0.94 * iris_ring + fibers + 0.28 * core_glow + scanline - 1.50 * vertical_pupil).astype(
        np.float32
    )


def _processing_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    radial = np.sqrt((x * 0.95) ** 2 + (y * 1.05) ** 2)
    rings = np.cos(22.0 * radial - 3.0 * t)
    spiral = np.sin(7.0 * np.arctan2(y, x + 1e-4) + 11.0 * radial - 2.7 * t)
    lattice = np.cos(18.0 * x + 2.2 * t) * np.cos(18.0 * y - 2.0 * t)
    core = np.exp(-7.0 * radial**2)
    pulse = np.exp(-58.0 * (radial - (0.42 + 0.02 * np.sin(2.4 * t))) ** 2)
    return (0.28 * rings + 0.26 * spiral + 0.22 * lattice + 0.56 * core + 0.38 * pulse).astype(np.float32)


def _alert_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    jitter = 0.22 * np.sin(8.4 * t) + 0.08 * np.sin(16.8 * t + 1.1)
    x_shifted = x + jitter * np.sign(y + 0.001)

    radial = np.sqrt((x_shifted * 0.98) ** 2 + (y * 1.18) ** 2)
    core = np.exp(-6.7 * radial**2)

    interference = np.sin(28.0 * x + 8.0 * np.sin(9.0 * y + 4.4 * t) + 13.0 * t) * np.cos(23.0 * y - 8.8 * t)
    stripes = 0.20 * np.sign(np.sin(38.0 * y + 12.5 * t))
    split = 0.15 * np.sign(np.sin(22.0 * x - 10.5 * t))
    tear = np.exp(-((x - 0.20 * np.sin(3.2 * t)) / 0.045) ** 2) * np.exp(-(y / 0.88) ** 2)
    asymmetry = 0.24 * x

    return (0.44 * core + 0.34 * interference + stripes + split + 0.30 * tear + asymmetry).astype(np.float32)


def _hand_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    # Forearm + palm foundation.
    forearm = np.exp(-(((x + 0.42) / 0.44) ** 2 + ((y - 0.00) / 0.13) ** 2))
    palm = np.exp(-(((x - 0.02) / 0.25) ** 2 + ((y + 0.04) / 0.19) ** 2))

    # Finger bars with clear spacing for recognisable silhouette.
    index_finger = np.exp(-(((x - 0.18) / 0.06) ** 2 + ((y - 0.26) / 0.30) ** 2))
    middle_finger = np.exp(-(((x - 0.07) / 0.06) ** 2 + ((y - 0.31) / 0.34) ** 2))
    ring_finger = np.exp(-(((x + 0.03) / 0.06) ** 2 + ((y - 0.29) / 0.31) ** 2))
    pinky_finger = np.exp(-(((x + 0.13) / 0.06) ** 2 + ((y - 0.24) / 0.27) ** 2))
    thumb = np.exp(-(((x - 0.26) / 0.14) ** 2 + ((y - 0.02) / 0.09) ** 2))

    # Joint ridge and neon line traces across the palm.
    knuckles = np.exp(-(((x - 0.02) / 0.30) ** 2 + ((y - 0.14) / 0.07) ** 2))
    traces = 0.16 * np.cos(88.0 * (x + 0.02) + 2.3 * t) * np.exp(-((y + 0.02) / 0.42) ** 2)
    glow = 0.18 * np.exp(-2.2 * ((x - 0.03) ** 2 + (y - 0.10) ** 2))

    hand_shape = (
        0.42 * forearm
        + 0.92 * palm
        + 0.50 * index_finger
        + 0.56 * middle_finger
        + 0.52 * ring_finger
        + 0.45 * pinky_finger
        + 0.48 * thumb
        + 0.22 * knuckles
        + traces
        + glow
    )
    return hand_shape.astype(np.float32)


def _specter_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    # Hooded specter silhouette.
    head = np.exp(-((x / 0.17) ** 2 + ((y + 0.56) / 0.16) ** 2))
    hood_outer = np.exp(-((x / 0.34) ** 2 + ((y + 0.48) / 0.28) ** 2))
    hood_inner = np.exp(-((x / 0.19) ** 2 + ((y + 0.48) / 0.17) ** 2))
    hood = np.clip(hood_outer - 0.72 * hood_inner, 0.0, None)

    torso = np.exp(-((x / 0.34) ** 2 + ((y + 0.03) / 0.50) ** 2))
    shoulders = np.exp(-((x / 0.58) ** 2 + ((y + 0.22) / 0.15) ** 2))
    haze = np.exp(-((x / 0.78) ** 2 + ((y + 0.10) / 0.95) ** 2))

    rain = 0.15 * np.cos(92.0 * x + 1.2 * np.sin(2.8 * t)) * np.exp(-0.55 * (y + 0.18) ** 2)
    flicker = 0.10 * np.sin(26.0 * (x - y) + 2.2 * t) * np.exp(-1.2 * (x**2 + y**2))
    return (0.78 * head + 0.62 * hood + 0.82 * torso + 0.46 * shoulders + 0.22 * haze + rain + flicker).astype(
        np.float32
    )


def _tunnel_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    depth = np.clip(y + 1.14, 0.12, None)
    inv_depth = 1.0 / depth

    vertical = np.cos(18.0 * x * inv_depth - 2.8 * t)
    horizontal = np.cos(16.0 * inv_depth + 2.1 * t)
    grid = 0.36 * vertical + 0.28 * horizontal

    rails = np.exp(-((np.abs(x) - (0.16 + 0.38 * depth)) / 0.035) ** 2) * np.exp(-1.3 * (y + 0.25) ** 2)
    vanish = np.exp(-26.0 * x**2 - 30.0 * (y + 0.92) ** 2)
    fog = 0.10 * np.cos(11.0 * (x + y) - 1.6 * t) * np.exp(-0.8 * (x**2 + (y + 0.2) ** 2))
    return (grid + 0.40 * rails + 0.62 * vanish + fog).astype(np.float32)


def _halftone_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    # Eye-driven halftone portrait.
    face = np.exp(-(((x + 0.08) / 0.72) ** 2 + ((y + 0.03) / 0.92) ** 2))
    cheek_shadow = np.exp(-(((x + 0.18) / 0.48) ** 2 + ((y - 0.10) / 0.34) ** 2))

    eye_white = np.exp(-(((x + 0.02) / 0.23) ** 2 + ((y + 0.03) / 0.10) ** 2))
    pupil = np.exp(-(((x + 0.03) / 0.07) ** 2 + ((y + 0.03) / 0.055) ** 2))
    brow = np.exp(-(((x + 0.04) / 0.31) ** 2 + ((y + 0.19) / 0.08) ** 2))
    lid = np.exp(-(((x + 0.02) / 0.27) ** 2 + ((y + 0.01) / 0.14) ** 2))

    dots = np.sin((x + 0.50) * 118.0) ** 2 * np.sin((y + 0.55) * 86.0) ** 2
    dot_gate = np.clip((dots - 0.30) * 1.8, 0.0, 1.0)

    structure = 0.54 * face + 0.24 * cheek_shadow + 0.88 * eye_white + 0.42 * brow + 0.24 * lid - 1.08 * pupil
    neon_noise = 0.08 * np.sin(21.0 * x - 13.0 * y - 1.4 * t) * face
    return (structure * (0.35 + 0.75 * dot_gate) + neon_noise).astype(np.float32)


def _boot_density(x: np.ndarray, y: np.ndarray, t: float) -> np.ndarray:
    jitter = 0.04 * np.sin(30.0 * y + 12.0 * t)
    x_j = x + jitter

    scan = 0.12 * np.sign(np.sin(90.0 * (y + 1.0) - 8.0 * t))
    header = np.exp(-((y + 0.76) / 0.12) ** 2) * np.exp(-((x_j + 0.02) / 0.95) ** 2)
    body = np.exp(-((y + 0.12) / 0.55) ** 2) * np.exp(-((x_j + 0.12) / 0.95) ** 2)

    glyph = np.clip(np.cos((x_j + 0.8) * 42.0) + np.cos((y + 1.0) * 120.0), 0.0, None)
    columns = (
        np.exp(-((x_j + 0.45) / 0.08) ** 2)
        + np.exp(-((x_j + 0.05) / 0.08) ** 2)
        + np.exp(-((x_j - 0.35) / 0.08) ** 2)
    )
    noise = 0.18 * np.sin(60.0 * x_j + 37.0 * y - 9.0 * t)
    return (0.38 * header + 0.34 * body * glyph + 0.20 * columns * np.exp(-0.7 * (y + 0.1) ** 2) + scan + 0.10 * noise).astype(np.float32)
