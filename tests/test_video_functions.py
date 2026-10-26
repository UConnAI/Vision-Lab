"""Parity checks against the actual browser tracking functions, without a CNN."""

import importlib.util
import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("video_functions", ROOT / "python" / "video_functions.py")
VIDEO = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VIDEO)


def ball(x=0, y=0, width=10, height=10, score=0.9, category="sports ball"):
    return {"class": category, "score": score, "bbox": [x, y, width, height]}


def browser(function, arguments):
    script = """
import fs from 'node:fs';
import * as tracking from './take-home-football-tracker/tracking.mjs';
import * as lecture from './lecture-math.mjs';
const request=JSON.parse(fs.readFileSync(0,'utf8'));
const fn=tracking[request.function]||lecture[request.function];
process.stdout.write(JSON.stringify(fn(...request.arguments)));
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
                            input=json.dumps({"function": function, "arguments": arguments}),
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


class VideoFunctionTests(unittest.TestCase):
    def assert_nested_close(self, actual, expected):
        if isinstance(expected, dict):
            self.assertEqual(set(actual), set(expected))
            for key in expected:
                self.assert_nested_close(actual[key], expected[key])
        elif isinstance(expected, list):
            self.assertEqual(len(actual), len(expected))
            for got, wanted in zip(actual, expected):
                self.assert_nested_close(got, wanted)
        elif isinstance(expected, (int, float)) and not isinstance(expected, bool):
            self.assertAlmostEqual(actual, expected, places=12)
        else:
            self.assertEqual(actual, expected)

    def test_coordinate_mapping_and_detector_boundary(self):
        self.assertEqual(VIDEO.fit_frame_size(1920, 1080), (960, 540))
        self.assertEqual(VIDEO.fit_frame_size(4, 3, 2), (2, 2))
        geometry = VIDEO.padding_geometry(960, 540)
        self.assertEqual(geometry, {"side": 1248, "dx": 144, "dy": 354})
        mapped = VIDEO.remove_padding([ball(544, 554, 100, 80)], geometry["dx"], geometry["dy"])
        self.assertEqual(mapped[0]["bbox"], [400, 200, 100, 80])
        selected = VIDEO.choose_ball(mapped)
        self.assertEqual((selected["x"], selected["y"]), (450, 240))
        self.assertAlmostEqual(selected["r"] * 0.9, 49.5)
        calls = []
        def adapter(frame, count, floor):
            calls.append((frame, count, floor))
            return [ball(score=0.34), ball(score=0.35), ball(category="person")]
        self.assertEqual(len(VIDEO.detect_balls("supplied frame", adapter)), 1)
        self.assertEqual(calls, [("supplied frame", 100, 0.2)])

    def test_selection_matches_browser_for_filtering_distance_and_ties(self):
        fixtures = [
            ([ball(width=20), ball(x=50, width=30), ball(score=0.1)], None, 0.35),
            ([ball(x=100), ball(x=10)], {"x": 12, "y": 5}, 0.35),
            ([ball(x=10), ball(x=20)], None, 0.35),
            ([ball(x=0), ball(x=20)], {"x": 15, "y": 5}, 0.35),
            ([ball(width=0), ball(score=0.349), ball(category="person")], None, 0.35),
            ([ball(score=0.35)], None, 0.35),
        ]
        for args in fixtures:
            with self.subTest(args=args):
                self.assert_nested_close(VIDEO.choose_ball(*args), browser("chooseBall", args))

    def test_trajectory_and_interpolation_match_browser_at_boundaries(self):
        raw = [
            {"t": 1.0, "objects": [ball(95, 195)]},
            {"t": 1.1, "objects": [ball(155, 225)]},
            {"t": 1.2, "objects": []},
            {"t": 1.3, "objects": [ball(195, 255)]},
        ]
        for smoothing in (0, 0.8):
            rows = VIDEO.trajectory(raw, 0.35, smoothing)
            self.assert_nested_close(rows, browser("trajectory", [raw, 0.35, smoothing]))
            for time in (0.9, 1.0, 1.04, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4, 1.401, 1.5):
                with self.subTest(smoothing=smoothing, time=time):
                    self.assert_nested_close(VIDEO.point_at(rows, time), browser("pointAt", [rows, time]))
        self.assertIsNone(VIDEO.point_at([], 0))
        long_gap = [{"t": 0, "point": {"x": 0, "y": 0, "r": 1}},
                    {"t": 0.31, "point": {"x": 10, "y": 0, "r": 2}}]
        self.assert_nested_close(VIDEO.point_at(long_gap, 0.1), browser("pointAt", [long_gap, 0.1]))

    def test_metrics_keep_false_detections_misses_and_unavailable_error(self):
        rows = [{"t": 0, "point": {"x": 3, "y": 4}},
                {"t": 0.1, "point": None}, {"t": 0.2, "point": {"x": 4, "y": 5}}]
        labels = [{"t": 0, "x": 0, "y": 0, "visible": True},
                  {"t": 0.1, "x": 1, "y": 2, "visible": True},
                  {"t": 0.2, "visible": False}, {"t": 0.4, "visible": False}]
        self.assert_nested_close(VIDEO.annotation_metrics(labels, rows, 100),
                                 browser("annotationMetrics", [labels, rows, 100]))
        self.assertEqual(VIDEO.annotation_metrics(labels, rows, 100),
                         {"labeled": 4, "detected": 1, "missed": 1,
                          "falsePositives": 1, "meanError": 0.05})
        self.assert_nested_close(VIDEO.annotation_metrics(labels, [], 100),
                                 browser("annotationMetrics", [labels, [], 100]))

    def test_iou_matches_browser_including_invalid_boxes(self):
        fixtures = [([60, 45, 100, 100], [90, 45, 100, 100]),
                    ([0, 0, 1, 1], [2, 2, 1, 1]),
                    ([0, 0, 1, 1], [0, 0, 1, 1]),
                    ([0, 0, 0, 1], [0, 0, 1, 1])]
        for args in fixtures:
            self.assert_nested_close(VIDEO.intersection_over_union(*args), browser("intersectionOverUnion", args))
        self.assertEqual(VIDEO.intersection_over_union([0, 0, float("nan"), 1], [0, 0, 1, 1]), 0)


if __name__ == "__main__":
    unittest.main()
