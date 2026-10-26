import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


@unittest.skipUnless(importlib.util.find_spec("torch"), "Optional PyTorch dependency is not installed")
class TinyCNNTests(unittest.TestCase):
    def test_failed_video_open_releases_capture_without_reading(self):
        from render_trail import Position
        from tiny_cnn import prepare_data
        rows = {i: Position(i, True, 20, 30) for i in range(18)}
        cv2 = Mock()
        capture = cv2.VideoCapture.return_value
        capture.isOpened.return_value = False
        with patch('render_trail._opencv', return_value=cv2), patch('render_trail.load_positions', return_value=rows):
            with self.assertRaisesRegex(ValueError, 'Cannot open video.*codec support'):
                prepare_data('synthetic-unavailable-video', 'synthetic-positions')
        capture.read.assert_not_called()
        capture.release.assert_called_once()

    def test_failed_seek_never_reads_a_misaligned_frame_and_releases_capture(self):
        from render_trail import Position
        from tiny_cnn import prepare_data
        rows = {i: Position(i, True, 20, 30) for i in range(18)}
        cv2 = Mock()
        capture = cv2.VideoCapture.return_value
        capture.isOpened.return_value = True
        capture.get.side_effect = [96, 64]
        capture.set.return_value = False
        with patch('render_trail._opencv', return_value=cv2), patch('render_trail.load_positions', return_value=rows):
            with self.assertRaisesRegex(ValueError, 'Cannot seek to CSV frame 0.*matching video frame'):
                prepare_data('synthetic-unseekable-video', 'synthetic-positions')
        capture.set.assert_called_once_with(cv2.CAP_PROP_POS_FRAMES, 0)
        capture.read.assert_not_called()
        capture.release.assert_called_once()

    def test_python_architectures_match_browser_parameter_counts_and_seed(self):
        import torch
        from tiny_cnn import SPECS, build_model
        for filters, expected in zip(SPECS.values(), [1266, 922, 1870]):
            first, second = build_model(filters), build_model(filters)
            self.assertEqual(sum(p.numel() for p in first.parameters()), expected)
            image = torch.ones(1, 3, 18, 32)
            self.assertTrue(torch.equal(first(image), second(image)))
            self.assertEqual(tuple(first(image).shape), (1, 2))

    def test_full_training_pipeline_on_a_small_generated_video(self):
        from render_trail import _opencv
        from tiny_cnn import compare
        cv2 = _opencv()
        import numpy as np
        (ROOT / ".tmp").mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / ".tmp") as directory:
            folder = Path(directory)
            writer = cv2.VideoWriter(str(folder / "test.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), 24, (96, 64))
            self.assertTrue(writer.isOpened())
            rows = ["Frame,Visibility,X,Y"]
            rng = np.random.default_rng(314)
            for frame in range(24):
                image = rng.integers(0, 15, (64, 96, 3), dtype=np.uint8)
                x, y = 15 + frame * 2, 30
                cv2.circle(image, (x, y), 5, (10, 140, 240), -1)
                writer.write(image)
                rows.append(f"{frame},1,{x},{y}")
            writer.release()
            (folder / "test.csv").write_text("\n".join(rows), encoding="utf-8")
            result = compare(folder / "test.mp4", folder / "test.csv", epochs=2)
            self.assertEqual(result["split"], [14, 5, 5])
            self.assertEqual(len(result["results"]), 4)
            self.assertTrue(all(np.isfinite(row["test_error_px"]) for row in result["results"]))


if __name__ == "__main__":
    unittest.main()
