"""Readable Python equivalents of the workshop's hand and RPS calculations.

These functions mirror vision-lab.mjs and core.mjs on the documented inputs.
They process landmark dictionaries and saved observations; they do not open a
camera or run MediaPipe. Times are milliseconds, and samples are chronological.
Run this complete file with ``python python/hand_functions.py``.
"""

from math import hypot, sqrt

LABELS = ("rock", "paper", "scissors")


# region hand_control
def pinch_ratio(points):
    """Thumb/index gap divided by palm width, using normalized 2D points."""
    def distance(a, b):
        return hypot(points[a]["x"] - points[b]["x"],
                     points[a]["y"] - points[b]["y"])

    return distance(4, 8) / max(distance(5, 17), 0.001)


def cursor_position(points, width=800, height=600):
    """Mirror the index tip into drawing-buffer coordinates, not CSS pixels."""
    return ((1 - points[8]["x"]) * width, points[8]["y"] * height)


def camera_brush(gesture, score, pinch, time, palm_since=None):
    """Pinch paints; a confident palm needs a 350 ms hold before erasing.

    Carry result["palmSince"] into the next call. Dictionary keys match the
    browser's state object so that saved fixtures can be compared directly.
    """
    if pinch:
        return {"tool": "pen", "down": True, "palmSince": None}
    if gesture == "Open_Palm" and score >= 0.6:
        since = time if palm_since is None else palm_since
        return {"tool": "eraser", "down": time - since >= 350,
                "palmSince": since}
    return {"tool": "pen", "down": False, "palmSince": None}
# endregion


# region early_features
def openness(points):
    """Four finger straightness ratios, using x/y and available z coordinates."""
    def distance(a, b):
        return hypot(a["x"] - b["x"], a["y"] - b["y"],
                     (a.get("z") or 0) - (b.get("z") or 0))

    values = []
    for start in (5, 9, 13, 17):
        length = sum(distance(points[j], points[j + 1])
                     for j in range(start, start + 3))
        ratio = distance(points[start], points[start + 3]) / length if length else 0
        values.append(max(0, min(1, ratio)))
    return values


def features(samples, cutoff):
    """Return four recent straightness values and four rates, or None.

    A sample is {"t": milliseconds, "v": [index, middle, ring, little]}.
    Only the last 450 ms up to cutoff may enter the prediction. Require four
    observations, a span of at least 100 ms and a final age at most 150 ms.
    """
    recent = [s for s in samples if cutoff - 450 <= s["t"] <= cutoff]
    if len(recent) < 4:
        return None
    first, last = recent[0], recent[-1]
    if cutoff - last["t"] > 150 or last["t"] - first["t"] < 100:
        return None
    seconds = (last["t"] - first["t"]) / 1000
    rates = [(end - start) / seconds
             for start, end in zip(first["v"], last["v"])]
    return list(last["v"]) + rates


def finger_movement(samples, cutoff=float("inf")):
    """Attempt-wide fallback: describe movement without predicting an RPS move.

    This intentionally uses a different window from features(): all observations
    at or before cutoff, with two observations and a straightness range >= 0.12.
    It has no recent-sample freshness or minimum-span requirement.
    """
    observed = [sample for sample in samples if sample["t"] <= cutoff]
    if len(observed) < 2:
        return {"names": [], "available": False}
    names = []
    for i, name in enumerate(("Index", "Middle", "Ring", "Little")):
        values = [sample["v"][i] for sample in observed]
        if max(values) - min(values) >= 0.12:
            names.append(name)
    return {"names": names, "available": True}
# endregion


# region centroid_classifier
def train(rows):
    """Fit training-only population scaling and one center per RPS class.

    Each row is {"label": class_name, "x": eight_features}. The browser requires
    at least three rows per class. No test observations enter these statistics.
    """
    groups = [[row for row in rows if row["label"] == label] for label in LABELS]
    if any(len(group) < 3 for group in groups):
        return None
    count = len(rows)
    mean = [sum(row["x"][i] / count for row in rows) for i in range(8)]
    scale = [max(sqrt(sum((row["x"][i] - mean[i]) ** 2 / count
                          for row in rows)), 0.05) for i in range(8)]
    centers = [
        [sum((row["x"][i] - mean[i]) / scale[i] for row in group) / len(group)
         for i in range(8)]
        for group in groups
    ]
    counts = [len(group) for group in groups]
    return {"mean": mean, "scale": scale, "centers": centers,
            "majority": LABELS[counts.index(max(counts))], "count": count}


def predict(model, x):
    """Nearest standardized class center; distances are not probabilities."""
    if model is None or x is None:
        return None
    z = [(value - mean) / scale
         for value, mean, scale in zip(x, model["mean"], model["scale"])]
    distances = [sum((center[i] - z[i]) ** 2 for i in range(8))
                 for center in model["centers"]]
    # index() breaks an exact tie in LABELS order, as the browser does.
    return {"label": LABELS[distances.index(min(distances))],
            "distances": distances}


def counter(move):
    """The computer's move that beats its frozen guess of the human's move."""
    return {"rock": "paper", "paper": "scissors", "scissors": "rock"}.get(move)
# endregion


# region round_deadline
def freeze_at_deadline(samples, cutoff, reveal, now, already_locked=False):
    """Python equivalent of app.mjs's one-time deadline gate in tick().

    The caller keeps the returned payload and sets already_locked afterward.
    A callback reaching reveal is too late to create an early prediction, even
    when earlier samples exist. Observed movement can still be reported.
    """
    if already_locked or now < cutoff:
        return None
    return {"locked": True, "lockTime": now,
            "x": features(samples, cutoff) if now < reveal else None,
            "movement": finger_movement(samples, cutoff)}
# endregion


if __name__ == "__main__":
    samples = [
        {"t": t, "v": [0.4 + i * 0.1, 0.5 + i * 0.1,
                        0.3 + i / 60, 0.4 + i / 60]}
        for i, t in enumerate((550, 650, 750, 850))
    ]
    print("Eight features:", features(samples, cutoff=1000))
    print("Movement fallback:", finger_movement(samples, cutoff=1000))
    print("On-time freeze:", freeze_at_deadline(samples, 1000, 1300, 1008))
    print("Late freeze:", freeze_at_deadline(samples, 1000, 1300, 1300))
    print("Palm after 350 ms:", camera_brush("Open_Palm", 0.6, False, 1600, 1250))
