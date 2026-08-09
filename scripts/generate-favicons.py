#!/usr/bin/env python3

from __future__ import annotations

import json
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THEME = "#0d1726"
SURFACE = "#ffffff"
VIEWBOX_SIZE = 64.0
SAMPLES_PER_AXIS = 4

SVG_SOURCE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title desc">
  <title id="title">Antonio Pereira Web favicon</title>
  <desc id="desc">A white map pin on a near-black tile with restrained blue, red, yellow, and green corner markers.</desc>
  <rect x="4" y="4" width="56" height="56" rx="18" fill="#0d1726"/>
  <rect x="4.75" y="4.75" width="54.5" height="54.5" rx="17.25" fill="none" stroke="#ffffff" stroke-opacity="0.18"/>
  <rect x="11" y="11" width="9" height="9" rx="4.5" fill="#0b57d0"/>
  <rect x="44" y="11" width="9" height="9" rx="4.5" fill="#d93025"/>
  <rect x="11" y="44" width="9" height="9" rx="4.5" fill="#f9ab00"/>
  <rect x="44" y="44" width="9" height="9" rx="4.5" fill="#137a49"/>
  <path fill="#ffffff" d="M32 15.5c-8.2 0-14.5 5.92-14.5 13.8 0 9.96 10.34 18.85 13.15 21.04.8.62 1.9.62 2.7 0 2.81-2.19 13.15-11.08 13.15-21.04 0-7.88-6.3-13.8-14.5-13.8Z"/>
  <circle cx="32" cy="29.2" r="6.65" fill="#0d1726"/>
</svg>
"""

MANIFEST = {
    "name": "Antonio Pereira Web",
    "short_name": "AP Web",
    "start_url": "/",
    "display": "standalone",
    "theme_color": THEME,
    "background_color": SURFACE,
    "icons": [
        {
            "src": "android-chrome-192x192.png",
            "sizes": "192x192",
            "type": "image/png",
        },
        {
            "src": "android-chrome-512x512.png",
            "sizes": "512x512",
            "type": "image/png",
        },
    ],
}

PNG_TARGETS = {
    "apple-touch-icon.png": 180,
    "android-chrome-192x192.png": 192,
    "android-chrome-512x512.png": 512,
}

ICO_SIZES = (16, 32, 48)

PIN_POINTS = (
    (32.0, 15.5),
    (26.6, 16.4),
    (21.8, 19.1),
    (18.7, 23.6),
    (17.5, 29.3),
    (18.9, 34.7),
    (21.9, 39.2),
    (25.3, 42.8),
    (28.6, 45.6),
    (31.1, 47.5),
    (32.0, 48.1),
    (32.9, 47.5),
    (35.4, 45.6),
    (38.7, 42.8),
    (42.1, 39.2),
    (45.1, 34.7),
    (46.5, 29.3),
    (45.3, 23.6),
    (42.2, 19.1),
    (37.4, 16.4),
)

TRANSPARENT = (0.0, 0.0, 0.0, 0.0)
WHITE = (1.0, 1.0, 1.0, 1.0)
DARK = (13 / 255.0, 23 / 255.0, 38 / 255.0, 1.0)
STROKE = (1.0, 1.0, 1.0, 0.18)
BLUE = (11 / 255.0, 87 / 255.0, 208 / 255.0, 1.0)
RED = (217 / 255.0, 48 / 255.0, 37 / 255.0, 1.0)
YELLOW = (249 / 255.0, 171 / 255.0, 0.0, 1.0)
GREEN = (19 / 255.0, 122 / 255.0, 73 / 255.0, 1.0)


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def inside_rounded_rect(x: float, y: float, left: float, top: float, right: float, bottom: float, radius: float) -> bool:
    if x < left or x > right or y < top or y > bottom:
        return False

    clamped_x = min(max(x, left + radius), right - radius)
    clamped_y = min(max(y, top + radius), bottom - radius)
    dx = x - clamped_x
    dy = y - clamped_y
    return dx * dx + dy * dy <= radius * radius


def inside_circle(x: float, y: float, center_x: float, center_y: float, radius: float) -> bool:
    dx = x - center_x
    dy = y - center_y
    return dx * dx + dy * dy <= radius * radius


def inside_polygon(x: float, y: float, points: tuple[tuple[float, float], ...]) -> bool:
    inside = False
    total_points = len(points)

    for index in range(total_points):
        x1, y1 = points[index]
        x2, y2 = points[(index + 1) % total_points]
        crosses = (y1 > y) != (y2 > y)
        if not crosses:
            continue
        intersection_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
        if x < intersection_x:
            inside = not inside

    return inside


def over(bottom: tuple[float, float, float, float], top: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    top_alpha = top[3]
    if top_alpha <= 0.0:
        return bottom

    bottom_alpha = bottom[3]
    output_alpha = top_alpha + bottom_alpha * (1.0 - top_alpha)
    if output_alpha <= 0.0:
        return TRANSPARENT

    red = (top[0] * top_alpha + bottom[0] * bottom_alpha * (1.0 - top_alpha)) / output_alpha
    green = (top[1] * top_alpha + bottom[1] * bottom_alpha * (1.0 - top_alpha)) / output_alpha
    blue = (top[2] * top_alpha + bottom[2] * bottom_alpha * (1.0 - top_alpha)) / output_alpha
    return (red, green, blue, output_alpha)


def sample_icon(x: float, y: float) -> tuple[float, float, float, float]:
    color = TRANSPARENT

    outer_tile = inside_rounded_rect(x, y, 4.0, 4.0, 60.0, 60.0, 18.0)
    inner_tile = inside_rounded_rect(x, y, 5.45, 5.45, 58.55, 58.55, 16.55)

    if outer_tile:
        color = over(color, DARK)
    if outer_tile and not inner_tile:
        color = over(color, STROKE)

    if inside_circle(x, y, 15.5, 15.5, 4.5):
        color = over(color, BLUE)
    if inside_circle(x, y, 48.5, 15.5, 4.5):
        color = over(color, RED)
    if inside_circle(x, y, 15.5, 48.5, 4.5):
        color = over(color, YELLOW)
    if inside_circle(x, y, 48.5, 48.5, 4.5):
        color = over(color, GREEN)

    if inside_polygon(x, y, PIN_POINTS):
        color = over(color, WHITE)
    if inside_circle(x, y, 32.0, 29.2, 6.65):
        color = over(color, DARK)

    return color


def render_rgba(size: int) -> bytes:
    rows = bytearray()
    samples = SAMPLES_PER_AXIS * SAMPLES_PER_AXIS

    for pixel_y in range(size):
        rows.append(0)
        for pixel_x in range(size):
            red = green = blue = alpha = 0.0

            for sample_y in range(SAMPLES_PER_AXIS):
                for sample_x in range(SAMPLES_PER_AXIS):
                    icon_x = ((pixel_x + (sample_x + 0.5) / SAMPLES_PER_AXIS) / size) * VIEWBOX_SIZE
                    icon_y = ((pixel_y + (sample_y + 0.5) / SAMPLES_PER_AXIS) / size) * VIEWBOX_SIZE
                    sample = sample_icon(icon_x, icon_y)
                    red += sample[0]
                    green += sample[1]
                    blue += sample[2]
                    alpha += sample[3]

            rows.extend(
                (
                    round(red / samples * 255),
                    round(green / samples * 255),
                    round(blue / samples * 255),
                    round(alpha / samples * 255),
                )
            )

    return bytes(rows)


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    )


def build_png(size: int) -> bytes:
    raw = render_rgba(size)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, level=9)
    return b"".join(
        (
            b"\x89PNG\r\n\x1a\n",
            png_chunk(b"IHDR", ihdr),
            png_chunk(b"IDAT", idat),
            png_chunk(b"IEND", b""),
        )
    )


def write_png(path: Path, size: int) -> bytes:
    png_bytes = build_png(size)
    path.write_bytes(png_bytes)
    return png_bytes


def build_ico() -> bytes:
    png_entries = [(size, build_png(size)) for size in ICO_SIZES]
    header = struct.pack("<HHH", 0, 1, len(png_entries))
    directory = bytearray()
    image_data = bytearray()
    offset = 6 + len(png_entries) * 16

    for size, png_bytes in png_entries:
        width_byte = 0 if size == 256 else size
        height_byte = 0 if size == 256 else size
        directory.extend(
            struct.pack(
                "<BBBBHHII",
                width_byte,
                height_byte,
                0,
                0,
                1,
                32,
                len(png_bytes),
                offset,
            )
        )
        image_data.extend(png_bytes)
        offset += len(png_bytes)

    return header + bytes(directory) + bytes(image_data)


def write_ico(path: Path) -> None:
    path.write_bytes(build_ico())


def main() -> None:
    write_text(ROOT / "favicon.svg", SVG_SOURCE)
    write_text(ROOT / "site.webmanifest", json.dumps(MANIFEST, indent=2) + "\n")

    for filename, size in PNG_TARGETS.items():
        write_png(ROOT / filename, size)

    write_ico(ROOT / "favicon.ico")


if __name__ == "__main__":
    main()
