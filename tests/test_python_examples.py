"""Run: python -m unittest discover -s tests -p test_python_examples.py"""
import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
import backprop_numpy as tiny
import symbol_cnn


def node_json(script):
    result = subprocess.run(["node", "--input-type=module", "-e", script],
                            cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


class PythonLectureTests(unittest.TestCase):
    def assert_tree_near(self, actual, expected):
        if isinstance(expected, dict):
            self.assertEqual(set(actual), set(expected))
            for key in expected:
                self.assert_tree_near(actual[key], expected[key])
        else:
            np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)

    def test_numpy_matches_every_browser_forward_gradient_and_update(self):
        expected = node_json("import {initialParameters,sgdStep} from './math-backprop-core.mjs'; console.log(JSON.stringify([0,1].map(t=>sgdStep(initialParameters(),t,.1))));")
        for target in (0, 1):
            self.assert_tree_near(tiny.sgd_step(tiny.initial_parameters(), target), expected[target])

    def test_all_fifteen_derivatives_and_simultaneous_nonmutating_update(self):
        parameters = tiny.initial_parameters()
        saved = copy.deepcopy(parameters)
        check = tiny.gradient_check(parameters)
        self.assertEqual(len(check["entries"]), 15)
        self.assertLess(check["maxAbsoluteError"], 1e-8)
        self.assertFalse(check["nearReluKink"])
        step = tiny.sgd_step(parameters)
        self.assertLess(step["afterLoss"], step["beforeLoss"])
        self.assert_tree_near(parameters, saved)

    def test_extreme_logits_and_closed_relu_gates(self):
        parameters = tiny.initial_parameters()
        parameters["dense"][:] = 0
        parameters["denseBias"][:] = [1000, -1000]
        result = tiny.forward(parameters, target=1)
        self.assertEqual(result["loss"], 2000)
        np.testing.assert_array_equal(result["probabilities"], [1, 0])
        parameters = tiny.initial_parameters()
        parameters["convBias"] = -1.5
        gradients = tiny.backward(parameters)
        np.testing.assert_array_equal(gradients["kernel"], np.zeros((2, 2)))
        np.testing.assert_array_equal(gradients["dZ"], np.zeros((2, 2)))
        self.assertLess(tiny.gradient_check(parameters)["maxAbsoluteError"], 1e-8)

    def test_ported_generator_matches_browser_pixels_labels_and_split_order(self):
        expected = node_json("import {makeSplits} from './cnn-lab-core.mjs'; const data=makeSplits(); console.log(JSON.stringify(Object.values(data).map(rows=>({labels:rows.map(r=>r.label),examples:[0,1,rows.length-1].map(i=>Array.from(rows[i].pixels))}))));")
        splits = symbol_cnn.make_splits()
        for dataset, reference in zip(splits, expected):
            images, labels = dataset.tensors
            self.assertEqual(labels.tolist(), reference["labels"])
            sample = images[[0, 1, len(dataset) - 1]].reshape(3, 256).numpy()
            np.testing.assert_allclose(sample, reference["examples"], rtol=0, atol=1e-7)

    def test_pytorch_shape_parameter_count_and_real_optimizer_update(self):
        torch.manual_seed(314)
        model = symbol_cnn.create_model()
        self.assertEqual(sum(p.numel() for p in model.parameters()), 1283)
        images = torch.ones((2, 1, 16, 16))
        logits = model(images)
        self.assertEqual(tuple(logits.shape), (2, 3))
        before = [p.detach().clone() for p in model.parameters()]
        optimizer = torch.optim.Adam(model.parameters(), lr=.01, eps=1e-7)
        loss = torch.nn.functional.cross_entropy(logits, torch.tensor([0, 1]))
        loss.backward()
        optimizer.step()
        self.assertTrue(any(not torch.equal(old, new) for old, new in zip(before, model.parameters())))
        self.assertTrue(torch.isfinite(model(images)).all())


if __name__ == "__main__":
    unittest.main()
