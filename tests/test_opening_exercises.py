"""Check worked answers, Python/browser parity and the downloadable notebook."""
import contextlib
import io
import json
from math import isclose
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
import opening_exercises as opening


class OpeningExerciseTests(unittest.TestCase):
    def assert_tree_near(self, actual, expected):
        if isinstance(expected, dict):
            self.assertEqual(set(actual), set(expected))
            for key in expected:
                self.assert_tree_near(actual[key], expected[key])
        elif isinstance(expected, list):
            self.assertEqual(len(actual), len(expected))
            for left, right in zip(actual, expected):
                self.assert_tree_near(left, right)
        elif isinstance(expected, (float, int)):
            self.assertTrue(isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-12))
        else:
            self.assertEqual(actual, expected)

    def test_orientation_and_independent_patch_answers(self):
        self.assertEqual(opening.compare_four_pixels(1, -1, -1, 1)["score"], 4)
        self.assertEqual(opening.classify_diagonal([[1, -1], [-1, 1]])["label"], "backslash")
        self.assertEqual(opening.classify_diagonal([[-1, 1], [1, -1]])["score"], -4)
        self.assertEqual(opening.classify_diagonal([[1, 1], [1, 1]])["label"], "no preference")
        image = opening.bright_square()
        self.assertEqual(opening.kernel_response(image, opening.KERNELS["vertical"], 2, 1)["raw"], 3)
        trace = opening.kernel_response(image, opening.KERNELS["vertical"], 2, 3, True)
        self.assertEqual((trace["raw"], trace["output"]), (-3, 0))
        self.assertEqual(opening.filter_photo_patch(opening.bright_square(), opening.KERNELS["vertical"], 2, 3), 0)
        self.assertEqual(len(opening.feature_matches(opening.feature_image("stripes"), opening.KERNELS["eyebrow"])["matches"]), 14)

    def test_python_matches_live_browser_calculations(self):
        script = """import {classifyDiagonal,brightSquare,kernelResponse,convolve,featureImage,featureMatches,KERNELS} from './opening.mjs';
console.log(JSON.stringify({diagonal:classifyDiagonal([[.2,-.5],[.7,.9]]),patch:kernelResponse(brightSquare(),KERNELS.vertical,2,3,true),maps:['vertical','horizontal','mean','sharpen'].map(k=>convolve(brightSquare(),KERNELS[k])),features:['face','rotated','stripes'].map(n=>featureMatches(featureImage(n),KERNELS.eyebrow,1.5))}));"""
        result = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
                                check=True, text=True, capture_output=True)
        actual = {"diagonal": opening.classify_diagonal([[.2, -.5], [.7, .9]]),
                  "patch": opening.kernel_response(opening.bright_square(), opening.KERNELS["vertical"], 2, 3, True),
                  "maps": [opening.convolve(opening.bright_square(), opening.KERNELS[name]) for name in ("vertical", "horizontal", "mean", "sharpen")],
                  "features": [opening.feature_matches(opening.feature_image(name), opening.KERNELS["eyebrow"], 1.5) for name in ("face", "rotated", "stripes")]}
        self.assert_tree_near(actual, json.loads(result.stdout))

    def test_invalid_inputs_are_not_silently_computed(self):
        for image in ([[1]], [[1, 2], [3]], [[float("nan"), 0], [0, 1]]):
            with self.assertRaises(ValueError):
                opening.classify_diagonal(image)
        with self.assertRaises(ValueError):
            opening.kernel_response(opening.bright_square(), opening.KERNELS["vertical"], 5, 0)

    def test_english_notebook_runs_all_code_without_external_images_or_packages(self):
        notebook = json.loads((ROOT / "python/opening_exercises.ipynb").read_text(encoding="utf-8"))
        namespace = {"__name__": "opening_notebook"}
        with contextlib.redirect_stdout(io.StringIO()) as output:
            for cell in notebook["cells"]:
                if cell["cell_type"] == "code":
                    exec("".join(cell["source"]), namespace)
        self.assertIn("stripes", output.getvalue())
        self.assertTrue(all(not ("\u4e00" <= char <= "\u9fff") for cell in notebook["cells"] for char in "".join(cell["source"])))
