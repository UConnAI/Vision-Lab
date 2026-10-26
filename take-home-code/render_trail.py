"""Render a complete video from frame-indexed CSV positions.

CSV columns: Frame,Visibility,X,Y. Frame numbers start at zero. Visibility is
0 or 1; invisible coordinates may be blank. Extra columns, such as Source, are
allowed. Positions are supplied data: this script does not run a detector.

Example from this directory:
  python render_trail.py --video ../take-home-football-tracker/assets/single-ball.mp4 \
      --positions data/soccer.csv --output outputs/soccer-trail.mp4
"""
from __future__ import annotations

import argparse
from collections import deque
import csv
from dataclasses import dataclass
import json
import math
from pathlib import Path
import sys

_CV2 = None


@dataclass(frozen=True)
class Position:
    frame: int
    visible: bool
    x: float | None = None
    y: float | None = None
    source: str = "csv"


def load_positions(path: str | Path) -> dict[int, Position]:
    """Use the Frame field as the key; row order and CSV length are irrelevant."""
    positions = {}
    with Path(path).open(newline="", encoding="utf-8-sig") as handle:
        rows = csv.DictReader(handle)
        required = {"Frame", "Visibility", "X", "Y"}
        if not required.issubset(rows.fieldnames or []):
            raise ValueError("CSV needs Frame,Visibility,X,Y columns.")
        for line, row in enumerate(rows, start=2):
            try:
                frame = int(row["Frame"])
                visibility = int(row["Visibility"])
                if frame < 0 or visibility not in (0, 1):
                    raise ValueError("Frame must be nonnegative; Visibility must be 0 or 1.")
                if frame in positions:
                    raise ValueError(f"Duplicate Frame {frame}.")
                x, y = (float(row["X"]), float(row["Y"])) if visibility else (None, None)
                if visibility and not (math.isfinite(x) and math.isfinite(y)):
                    raise ValueError("Visible coordinates must be finite numbers.")
                positions[frame] = Position(frame, bool(visibility), x, y,
                                             row.get("Source", "csv") or "csv")
            except (TypeError, ValueError) as error:
                raise ValueError(f"CSV line {line}: {error}") from error
    return positions


def position_at(positions, frame, width, height):
    """Missing or invisible rows produce no new point; no position is invented."""
    row = positions.get(frame)
    if row is None or not row.visible:
        return None
    if not (0 <= row.x < width and 0 <= row.y < height):
        raise ValueError(f"Frame {frame}: ({row.x}, {row.y}) is outside {width}x{height}.")
    return min(width - 1, round(row.x)), min(height - 1, round(row.y))


def trail_segments(history):
    """Only adjacent observed points connect. A None entry breaks the line."""
    points = list(history)
    return [(a, b) for a, b in zip(points, points[1:])
            if a is not None and b is not None]


def _opencv():
    global _CV2
    if _CV2 is not None:
        return _CV2
    # Development dependencies can live inside this folder without a global install.
    local = Path(__file__).parent / ".python-deps"
    if local.is_dir():
        sys.path.insert(0, str(local))
    try:
        import cv2
    except ImportError as error:
        raise RuntimeError("Install the optional video dependency: python -m pip install -r requirements.txt") from error
    _CV2 = cv2
    return _CV2


def draw_image_sticker(image, sticker, center, radius, fit="contain"):
    """Resize/crop an image sticker and blend its alpha over the video pixels."""
    cv2 = _opencv()
    import numpy as np
    if fit not in {"contain", "cover"}:
        raise ValueError("Sticker fit must be contain or cover.")
    height, width = sticker.shape[:2]
    if fit == "cover":
        side = min(width, height)
        top, left = (height - side) // 2, (width - side) // 2
        sticker = sticker[top:top + side, left:left + side]
        width = height = side
    scale = 2 * radius / max(width, height)
    new_width = max(1, round(width * scale))
    new_height = max(1, round(height * scale))
    resized = cv2.resize(sticker, (new_width, new_height), interpolation=cv2.INTER_AREA)
    left, top = center[0] - new_width // 2, center[1] - new_height // 2
    x0, y0 = max(0, left), max(0, top)
    x1, y1 = min(image.shape[1], left + new_width), min(image.shape[0], top + new_height)
    if x0 >= x1 or y0 >= y1:
        return image
    visible = resized[y0 - top:y1 - top, x0 - left:x1 - left]
    if visible.ndim == 2:
        visible = cv2.cvtColor(visible, cv2.COLOR_GRAY2BGR)
    colors = visible[:, :, :3].astype(np.float32)
    if visible.shape[2] == 4:
        alpha = visible[:, :, 3:4].astype(np.float32) / 255
    else:
        alpha = np.ones((*visible.shape[:2], 1), dtype=np.float32)
    background = image[y0:y1, x0:x1].astype(np.float32)
    image[y0:y1, x0:x1] = np.rint(colors * alpha + background * (1 - alpha)).astype(np.uint8)
    return image


def draw_frame(image, history, current, effect="trail", radius=14, sticker=None, sticker_fit="contain"):
    cv2 = _opencv()
    for first, second in trail_segments(history):
        cv2.line(image, first, second, (40, 190, 255), 3, cv2.LINE_AA)
    for index, point in enumerate(history):
        if point is not None:
            cv2.circle(image, point, max(2, 5 - index // 3), (40, 100, 255), -1, cv2.LINE_AA)
    if current is not None and effect == "capture":
        # The CSV supplies a center, not a ball radius. Radius is an artwork setting.
        x, y = current
        cv2.circle(image, current, radius, (245, 245, 245), -1, cv2.LINE_AA)
        cv2.ellipse(image, current, (radius, radius), 0, 180, 360, (60, 70, 235), -1, cv2.LINE_AA)
        cv2.line(image, (x - radius, y), (x + radius, y), (30, 35, 40), 3, cv2.LINE_AA)
        cv2.circle(image, current, radius, (30, 35, 40), 2, cv2.LINE_AA)
        cv2.circle(image, current, max(3, radius // 4), (245, 245, 245), -1, cv2.LINE_AA)
        cv2.circle(image, current, max(3, radius // 4), (30, 35, 40), 1, cv2.LINE_AA)
    if current is not None and effect == "rock":
        import numpy as np
        outline = np.array([[-.98, .12], [-.7, -.55], [-.08, -.93], [.64, -.64],
                            [.99, .04], [.69, .73], [-.39, .89]])
        vertices = np.rint(outline * radius + np.array(current)).astype(np.int32)
        center = np.rint(np.array([-.12, -.05]) * radius + np.array(current)).astype(np.int32)
        cv2.fillPoly(image, [vertices], (139, 127, 119), cv2.LINE_AA)
        for indices, color in [([0, 1, 2], (201, 189, 181)), ([2, 3, 4], (172, 157, 146)),
                               ([4, 5, 6], (109, 93, 83)), ([6, 0], (152, 138, 129))]:
            polygon = np.vstack([vertices[indices], center])
            cv2.fillPoly(image, [polygon], color, cv2.LINE_AA)
        cv2.polylines(image, [vertices], True, (255, 255, 255), max(2, round(radius * .07)), cv2.LINE_AA)
    if current is not None and effect == "custom":
        if sticker is None:
            raise ValueError("Choose a sticker image for the custom effect.")
        draw_image_sticker(image, sticker, current, radius, sticker_fit)
    return image


def render_video(video_path, positions_path, output_path, trail_length=8,
                 effect="trail", radius=14, save_frames=None, codec="mp4v",
                 sticker_path=None, sticker_fit="contain"):
    if trail_length < 1 or radius < 1 or effect not in {"trail", "capture", "rock", "custom"}:
        raise ValueError("Use a positive trail length/radius and trail, capture, rock or custom effect.")
    if sticker_fit not in {"contain", "cover"}:
        raise ValueError("Sticker fit must be contain or cover.")
    if len(codec) != 4:
        raise ValueError("Codec must be a four-character code, such as mp4v.")
    positions = load_positions(positions_path)
    cv2 = _opencv()
    sticker = None
    if effect == "custom":
        if sticker_path is None:
            raise ValueError("Use --sticker with --effect custom.")
        sticker = cv2.imread(str(sticker_path), cv2.IMREAD_UNCHANGED)
        if sticker is None:
            raise ValueError("Cannot read the sticker. Use PNG, JPEG or WebP for Python export.")
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    width, height = (int(capture.get(key)) for key in
                     (cv2.CAP_PROP_FRAME_WIDTH, cv2.CAP_PROP_FRAME_HEIGHT))
    if not math.isfinite(fps) or fps <= 0 or width <= 0 or height <= 0:
        capture.release()
        raise RuntimeError("The video has invalid dimensions or frame rate.")
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.resolve() == Path(video_path).resolve():
        capture.release()
        raise ValueError("Output must be a different file from the input video.")
    writer = cv2.VideoWriter(str(output), cv2.VideoWriter_fourcc(*codec), fps, (width, height))
    if not writer.isOpened():
        capture.release()
        writer.release()
        raise RuntimeError(f"VideoWriter could not open {output}; try another installed codec.")
    frames_folder = Path(save_frames) if save_frames else None
    if frames_folder:
        frames_folder.mkdir(parents=True, exist_ok=True)
    history = deque(maxlen=trail_length)
    frame_index = visible_count = missing_rows = 0
    try:
        while True:
            success, image = capture.read()
            if not success:
                break
            point = position_at(positions, frame_index, width, height)
            visible_count += int(point is not None)
            missing_rows += int(frame_index not in positions)
            history.appendleft(point)
            draw_frame(image, history, point, effect, radius, sticker, sticker_fit)
            writer.write(image)
            if frames_folder and not cv2.imwrite(str(frames_folder / f"frame{frame_index:05d}.jpg"), image):
                raise RuntimeError(f"Could not save image for frame {frame_index}.")
            frame_index += 1
    finally:
        writer.release()
        capture.release()
    return {"frames_written": frame_index, "fps": fps, "width": width, "height": height,
            "visible_position_frames": visible_count, "missing_csv_rows": missing_rows,
            "unused_csv_rows": sum(index >= frame_index for index in positions),
            "output": str(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--positions", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--trail-length", type=int, default=8)
    parser.add_argument("--effect", choices=["trail", "capture", "rock", "custom"], default="trail")
    parser.add_argument("--sticker", type=Path, help="PNG/JPEG/WebP image for --effect custom")
    parser.add_argument("--sticker-fit", choices=["contain", "cover"], default="contain")
    parser.add_argument("--radius", type=int, default=14)
    parser.add_argument("--save-frames", type=Path)
    parser.add_argument("--codec", default="mp4v")
    args = parser.parse_args()
    try:
        result = render_video(args.video, args.positions, args.output, args.trail_length,
                              args.effect, args.radius, args.save_frames, args.codec,
                              args.sticker, args.sticker_fit)
    except (ValueError, RuntimeError, OSError) as error:
        parser.exit(1, f"{error}\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
