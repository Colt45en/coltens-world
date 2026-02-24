from __future__ import annotations

from typing import Tuple

from .model_actions import clamp_norm_int


def _round_half_up_num_den(num: int, den: int) -> int:
    # round(num/den) half-up using integer arithmetic
    # result = floor((2*num + den) / (2*den))
    return (2 * num + den) // (2 * den)


def normalize_point(x_px: int, y_px: int, screen_w: int, screen_h: int) -> Tuple[int, int]:
    if screen_w <= 1:
        x_norm = 0
    else:
        den = screen_w - 1
        x_px = max(0, min(int(x_px), den))
        x_norm = _round_half_up_num_den(x_px * 1000, den)

    if screen_h <= 1:
        y_norm = 0
    else:
        den = screen_h - 1
        y_px = max(0, min(int(y_px), den))
        y_norm = _round_half_up_num_den(y_px * 1000, den)

    return (clamp_norm_int(x_norm), clamp_norm_int(y_norm))


def denormalize_point(x_norm: int, y_norm: int, screen_w: int, screen_h: int) -> Tuple[int, int]:
    x_norm = clamp_norm_int(int(x_norm))
    y_norm = clamp_norm_int(int(y_norm))

    if screen_w <= 1:
        x_px = 0
    else:
        den = screen_w - 1
        x_px = _round_half_up_num_den(x_norm * den, 1000)
        x_px = max(0, min(x_px, den))

    if screen_h <= 1:
        y_px = 0
    else:
        den = screen_h - 1
        y_px = _round_half_up_num_den(y_norm * den, 1000)
        y_px = max(0, min(y_px, den))

    return (x_px, y_px)


def normalize_box(x1_px: int, y1_px: int, x2_px: int, y2_px: int, screen_w: int, screen_h: int) -> Tuple[int, int, int, int]:
    x1, y1 = normalize_point(x1_px, y1_px, screen_w, screen_h)
    x2, y2 = normalize_point(x2_px, y2_px, screen_w, screen_h)
    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1
    return (x1, y1, x2, y2)


def denormalize_box(x1: int, y1: int, x2: int, y2: int, screen_w: int, screen_h: int) -> Tuple[int, int, int, int]:
    x1 = clamp_norm_int(int(x1)); y1 = clamp_norm_int(int(y1))
    x2 = clamp_norm_int(int(x2)); y2 = clamp_norm_int(int(y2))
    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1

    px1, py1 = denormalize_point(x1, y1, screen_w, screen_h)
    px2, py2 = denormalize_point(x2, y2, screen_w, screen_h)
    if px1 > px2:
        px1, px2 = px2, px1
    if py1 > py2:
        py1, py2 = py2, py1
    return (px1, py1, px2, py2)
