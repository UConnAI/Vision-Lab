"""Check the Python teaching functions against the actual JavaScript algorithms."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
import hand_functions as hand


def browser_result(expression, payload):
    script = ("import * as core from './core.mjs';"
              "import * as vision from './vision-lab.mjs';"
              "import fs from 'node:fs';"
              "const data=JSON.parse(fs.readFileSync(0,'utf8'));"
              f"console.log(JSON.stringify({expression}));")
    result = subprocess.run(["node", "--input-type=module", "-e", script],
                            input=json.dumps(payload), capture_output=True,
                            text=True, check=True, cwd=ROOT)
    return json.loads(result.stdout)


class HandFunctionTests(unittest.TestCase):
    def assert_tree_near(self, actual, expected):
        if isinstance(expected, dict):
            self.assertEqual(set(actual), set(expected))
            for key in expected:
                self.assert_tree_near(actual[key], expected[key])
        elif isinstance(expected, list):
            self.assertEqual(len(actual), len(expected))
            for a, b in zip(actual, expected):
                self.assert_tree_near(a, b)
        elif isinstance(expected, (str, bool)) or expected is None:
            self.assertEqual(actual, expected)
        else:
            self.assertAlmostEqual(actual, expected, delta=1e-12)

    def test_pinch_ratio_and_brush_dwell_boundaries_match_browser(self):
        points = [{"x": 0, "y": 0} for _ in range(21)]
        points[4], points[8] = {"x": .67, "y": .36}, {"x": .70, "y": .40}
        points[5], points[17] = {"x": .55, "y": .60}, {"x": .75, "y": .60}
        self.assertAlmostEqual(hand.pinch_ratio(points), .25)
        self.assert_tree_near(hand.pinch_ratio(points),
                              browser_result("vision.pinchRatio(data)", points))
        self.assert_tree_near(hand.cursor_position(points),
                              browser_result("[(1-data[8].x)*800,data[8].y*600]", points))
        self.assert_tree_near(hand.cursor_position(points, 320, 240), [96, 96])
        cases = [["Open_Palm", .6, False, 1250, None],
                 ["Open_Palm", .6, False, 1599, 1250],
                 ["Open_Palm", .6, False, 1600, 1250],
                 ["Open_Palm", .59, False, 1700, 1250],
                 ["Open_Palm", .9, True, 1700, 1250],
                 ["Victory", .9, False, 1700, 1250],
                 ["Open_Palm", .6, False, 350, 0]]
        self.assert_tree_near([hand.camera_brush(*case) for case in cases],
                              browser_result("data.map(c=>vision.cameraBrush(...c))", cases))

    def test_straightness_matches_three_dimensional_and_degenerate_chains(self):
        points = [{"x": 0, "y": 0, "z": 0} for _ in range(21)]
        for start, chain in zip((5, 9, 13, 17),
                                ([(0, 0, 0), (0, 1, 0), (1, 1, 0), (2, 1, 0)],
                                 [(0, 0, 0), (0, 0, 1), (0, 0, 2), (0, 0, 3)],
                                 [(0, 0, 0)] * 4,
                                 [(0, 0, 0), (0, 1, 1), (1, 1, 1), (1, 0, 0)])):
            for j, (x, y, z) in enumerate(chain):
                points[start + j] = {"x": x, "y": y, "z": z}
        self.assert_tree_near(hand.openness(points), browser_result("core.openness(data)", points))
        self.assertEqual(hand.openness(points)[1:3], [1, 0])

    def test_feature_windows_cutoff_freshness_span_and_future_exclusion(self):
        valid = [{"t": t, "v": [.4 + i / 10, .5 + i / 10, .3, .4]}
                 for i, t in enumerate((550, 650, 750, 850))]
        future = valid + [{"t": 1001, "v": [9, 9, 9, 9]}]
        stale = copy.deepcopy(valid)
        stale[-1]["t"] = 849
        short = [{"t": t, "v": [.4, .5, .3, .4]} for t in (901, 925, 950, 999)]
        outside = [{"t": 549, "v": [.4] * 4}] + valid[1:]
        cases = [valid, future, stale, valid[:3], short, outside, []]
        expected = browser_result("data.map(s=>core.features(s,1000))", cases)
        self.assert_tree_near([hand.features(s, 1000) for s in cases], expected)
        self.assertEqual(hand.features(valid, 1000), hand.features(future, 1000))
        self.assertIsNone(hand.features(stale, 1000))

    def test_attempt_wide_movement_is_distinct_from_recent_features(self):
        samples = [{"t": t, "v": [v, .2, .3, .4]}
                   for t, v in ((100, .2), (600, .4), (700, .4),
                                (800, .4), (900, .4), (1001, .9))]
        self.assert_tree_near(hand.finger_movement(samples, 1000),
                              browser_result("core.fingerMovement(data,1000)", samples))
        self.assertEqual(hand.finger_movement(samples, 1000)["names"], ["Index"])
        self.assertEqual(hand.features(samples, 1000)[4:], [0, 0, 0, 0])
        self.assertEqual(hand.finger_movement(samples[:1]), {"names": [], "available": False})

    def test_population_scaling_minimum_counts_ties_and_frozen_model(self):
        rows = [{"label": label, "x": [value, value + .2, 1, .4, value, 0, 0, 0]}
                for label, center in zip(hand.LABELS, (.2, .7, .4))
                for value in (center - .05, center, center + .05)]
        model = hand.train(rows)
        expected = browser_result("core.train(data)", rows)
        self.assert_tree_near(model, expected)
        self.assertEqual(model["scale"][2], .05)
        self.assertIsNone(hand.train(rows[:-1]))
        query = [.4, .6, 1, .4, .4, 0, 0, 0]
        saved = copy.deepcopy(model)
        self.assert_tree_near(hand.predict(model, query),
                              browser_result("core.predict(core.train(data.rows),data.x)",
                                             {"rows": rows, "x": query}))
        self.assertEqual(model, saved)
        tied = [{"label": label, "x": [1] * 8} for label in hand.LABELS for _ in range(3)]
        self.assertEqual(hand.predict(hand.train(tied), [1] * 8)["label"], "rock")
        self.assertEqual([hand.counter(label) for label in hand.LABELS],
                         browser_result("data.map(core.counter)", list(hand.LABELS)))

    def test_deadline_gate_rejects_late_callback_and_does_not_mutate_samples(self):
        samples = [{"t": t, "v": [.3 + i / 10] * 4}
                   for i, t in enumerate((550, 650, 750, 850))]
        cases = [{"now": 999, "locked": False}, {"now": 1000, "locked": False},
                 {"now": 1008, "locked": False}, {"now": 1300, "locked": False},
                 {"now": 1400, "locked": False}, {"now": 1008, "locked": True}]
        expected = browser_result("data.cases.map(c=>c.locked||c.now<1000?null:"
                                  "({locked:true,lockTime:c.now,"
                                  "x:c.now<1300?core.features(data.samples,1000):null,"
                                  "movement:core.fingerMovement(data.samples,1000)}))",
                                  {"cases": cases, "samples": samples})
        saved = copy.deepcopy(samples)
        actual = [hand.freeze_at_deadline(samples, 1000, 1300, c["now"], c["locked"])
                  for c in cases]
        self.assert_tree_near(actual, expected)
        self.assertIsNone(actual[3]["x"])
        self.assertEqual(samples, saved)


if __name__ == "__main__":
    unittest.main()
