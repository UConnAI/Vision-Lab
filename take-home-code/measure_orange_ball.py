"""Optional simple color measurement for the supplied orange ping-pong clip.

This is a color/shape rule, not a CNN. It can confuse similar colors and loses
the ball during occlusion or when it leaves the picture. Inspect the CSV rather
than treating it as ground truth. Every row comes from that frame's pixels.
"""
import argparse
import csv
from pathlib import Path

from render_trail import _opencv


def orange_center(image):
    cv2 = _opencv()
    import numpy as np

    height, width = image.shape[:2]
    working_width = min(480, width)
    working_height = round(height * working_width / width)
    small = cv2.resize(image, (working_width, working_height))
    b, g, r = (small[:, :, channel].astype(np.float32) for channel in (0, 1, 2))
    mask = ((r > 45) & (r >= g) & (g > b) & ((r - b) > 30)
            & ((g - b) >= 0.14 * (r - b)) & ((g - b) <= 0.9 * (r - b))
            & (g > 1.4 * b)).astype(np.uint8)
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    candidates = []
    for label in range(1, count):
        left, top, box_width, box_height, area = map(int, stats[label])
        ratio = box_width / box_height
        fill = area / (box_width * box_height)
        if area >= 8 and 10 <= box_width <= 110 and 10 <= box_height <= 110 and 0.45 <= ratio <= 2.2 and fill >= 0.25:
            candidates.append((area, left, top, box_width, box_height))
    if not candidates:
        return None
    _, left, top, box_width, box_height = max(candidates, key=lambda item: item[0])
    return ((left + box_width / 2) * width / working_width,
            (top + box_height / 2) * height / working_height)


def measure_video(video_path, output_path):
    cv2 = _opencv()
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    frame = found = 0
    try:
        with output.open("w", newline="", encoding="utf-8") as handle:
            rows = csv.writer(handle)
            rows.writerow(["Frame", "Visibility", "X", "Y", "Source"])
            while True:
                success, image = capture.read()
                if not success:
                    break
                point = orange_center(image)
                rows.writerow([frame, int(point is not None),
                               round(point[0], 3) if point else "",
                               round(point[1], 3) if point else "",
                               "color_component" if point else "none"])
                found += int(point is not None)
                frame += 1
    finally:
        capture.release()
    return {"frames": frame, "measured_positions": found, "output": str(output)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(measure_video(args.video, args.output))
