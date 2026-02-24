from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class ScreenSize:
    width: int
    height: int


def pixel_to_norm(x: int, y: int, size: ScreenSize) -> Tuple[int, int]:
    """Convert absolute pixel coords -> normalized 0..1000."""
    if size.width <= 0 or size.height <= 0:
        raise ValueError("Invalid screen size")
    nx = int(round((int(x) / size.width) * 1000))
    ny = int(round((int(y) / size.height) * 1000))
    nx = max(0, min(1000, nx))
    ny = max(0, min(1000, ny))
    return nx, ny


def norm_to_pixel(nx: int, ny: int, size: ScreenSize) -> Tuple[int, int]:
    """Convert normalized 0..1000 -> absolute pixel coords."""
    if size.width <= 0 or size.height <= 0:
        raise ValueError("Invalid screen size")
    x = int(round((int(nx) / 1000) * size.width))
    y = int(round((int(ny) / 1000) * size.height))
    x = max(0, min(size.width - 1, x))
    y = max(0, min(size.height - 1, y))
    return x, y


@dataclass(frozen=True)
class BBox:
    xmin: int
    ymin: int
    xmax: int
    ymax: int

    def contains_pixel(self, x: int, y: int) -> bool:
        return self.xmin <= x <= self.xmax and self.ymin <= y <= self.ymax


def point_in_norm_bbox(point_norm: Tuple[int, int], bbox_px: BBox, size: ScreenSize) -> bool:
    x, y = norm_to_pixel(point_norm[0], point_norm[1], size)
    return bbox_px.contains_pixel(x, y)
