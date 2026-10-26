"""Readable Python equivalents of Ball Remix's coordinate/tracking functions.

Only the Python standard library is needed. Detections are dictionaries with
``class``, ``score`` and ``bbox=[x, y, width, height]``, matching the browser.
These functions process detector output; they do not load or run a CNN. The
optional detector adapter below must be supplied by the caller. Times are in
seconds, coordinates in resized-frame pixels. Run this file for small examples.
"""

from math import ceil, floor, hypot, isfinite


# region ball_coordinates
def _finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)


def fit_frame_size(video_width, video_height, max_width=960):
    """Match the browser's aspect-preserving width cap and positive rounding."""
    width = min(max_width, video_width)
    height = floor(width * video_height / video_width + 0.5)
    return width, height


def padding_geometry(width, height):
    """Center the resized frame in the same 1.3-times padded square."""
    side = ceil(1.3 * max(width, height))
    return {"side": side, "dx": (side - width) / 2, "dy": (side - height) / 2}


def remove_padding(objects, dx, dy):
    """Map padded-canvas boxes back by translation; leave widths/heights alone."""
    result = []
    for obj in objects:
        x, y, width, height = obj["bbox"]
        result.append({**obj, "bbox": [x - dx, y - dy, width, height]})
    return result


def choose_ball(objects, previous=None, threshold=0.35):
    """Start with the largest accepted ball, then prefer the nearest center."""
    candidates = []
    for obj in objects:
        box = obj["bbox"]
        if (obj["class"] != "sports ball" or not obj["score"] >= threshold
                or not all(_finite_number(value) for value in box)
                or box[2] <= 0 or box[3] <= 0):
            continue
        x, y, width, height = box
        candidates.append({**obj, "x": x + width / 2, "y": y + height / 2,
                           "r": 0.55 * max(width, height)})
    if not candidates:
        return None
    if previous is not None:
        return min(candidates, key=lambda obj: hypot(obj["x"] - previous["x"],
                                                     obj["y"] - previous["y"]))
    return max(candidates, key=lambda obj: obj["bbox"][2] * obj["bbox"][3])
# endregion


# region temporal_tracking
def trajectory(rows, threshold, smoothing=0):
    """Associate sampled boxes; a missing row resets identity and smoothing."""
    previous = None
    result = []
    for row in rows:
        point = choose_ball(row["objects"], previous, threshold)
        if point is None:
            previous = None
        else:
            if previous is not None and smoothing:
                point["x"] = smoothing * previous["x"] + (1 - smoothing) * point["x"]
                point["y"] = smoothing * previous["y"] + (1 - smoothing) * point["y"]
            previous = point
        result.append({"t": row["t"], "point": point})
    return result


def point_at(rows, time):
    """Interpolate valid neighbors only; never bridge a missing-detection row."""
    if not rows:
        return None
    index = next((i for i, row in enumerate(rows) if row["t"] > time), None)
    left = rows[-1] if index is None else rows[index - 1] if index > 0 else None
    right = None if index is None else rows[index]
    if left is None or left["point"] is None:
        return None
    point = left["point"]
    if abs(time - left["t"]) < 0.0001:
        return {**point, "kind": "detected"}
    if right is None and time >= left["t"] and time - left["t"] < 0.101:
        return {**point, "kind": "held"}
    if (right is not None and right["point"] is not None
            and right["t"] - left["t"] <= 0.3 and time >= left["t"]):
        fraction = (time - left["t"]) / (right["t"] - left["t"])
        interpolated = dict(point)
        for coordinate in ("x", "y", "r"):
            interpolated[coordinate] += fraction * (right["point"][coordinate] - point[coordinate])
        return {**interpolated, "kind": "interpolated"}
    return None
# endregion


# region evaluation_metrics
def annotation_metrics(labels, rows, diagonal):
    """Keep misses and false detections separate from detected-center error."""
    detected = visible = false_positives = 0
    error = 0.0
    for label in labels:
        row = next((row for row in rows if abs(row["t"] - label["t"]) < 0.025), None)
        point = row["point"] if row is not None else None
        if label.get("visible") is False:
            if point is not None:
                false_positives += 1
            continue
        visible += 1
        if point is not None:
            detected += 1
            error += hypot(label["x"] - point["x"], label["y"] - point["y"]) / diagonal
    return {"labeled": len(labels), "detected": detected, "missed": visible - detected,
            "falsePositives": false_positives, "meanError": error / detected if detected else None}


def intersection_over_union(a, b):
    """The lecture's box-overlap helper; boxes use [x, y, width, height]."""
    if (not all(_finite_number(value) for value in [*a, *b])
            or a[2] <= 0 or a[3] <= 0 or b[2] <= 0 or b[3] <= 0):
        return 0
    width = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    height = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    intersection = width * height
    return intersection / (a[2] * a[3] + b[2] * b[3] - intersection)
# endregion


# region detector_pipeline
def detect_balls(frame, detect, threshold=0.35):
    """Call a supplied detector adapter, then apply the app's class/score rule.

    ``detect(frame, max_boxes, min_score)`` must return dictionaries with class,
    score and bbox after its own inference/suppression. The browser supplies a
    COCO-SSD model; this Python file bundles no detector. The adapter's score
    and suppression behavior belongs to that chosen implementation.
    """
    objects = detect(frame, 100, 0.2)
    return [obj for obj in objects
            if obj["class"] == "sports ball" and obj["score"] >= threshold]
# endregion


if __name__ == "__main__":
    padding = padding_geometry(960, 540)
    boxes = [{"class": "sports ball", "score": 0.9, "bbox": [544, 554, 100, 80]}]
    restored = remove_padding(boxes, padding["dx"], padding["dy"])
    print("Padded square:", padding)
    print("Mapped box:", restored[0]["bbox"])
    print("Selected center/radius:", choose_ball(restored))
    print("IoU after a 30-pixel shift:", intersection_over_union([60, 45, 100, 100], [90, 45, 100, 100]))
