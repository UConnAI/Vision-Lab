from collections import deque
import csv
import hashlib
from pathlib import Path
import random
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from render_trail import _opencv, draw_frame, draw_image_sticker, load_positions, position_at, render_video, trail_segments
from measure_orange_ball import measure_video, orange_center


class VideoTrailTests(unittest.TestCase):
    def test_custom_sticker_preserves_alpha_aspect_and_clips_at_frame_edges(self):
        import numpy as np
        background = np.full((20, 24, 3), 40, dtype=np.uint8)
        sticker = np.zeros((4, 8, 4), dtype=np.uint8)
        sticker[:, :4] = [0, 0, 240, 255]
        changed = draw_image_sticker(background.copy(), sticker, (12, 10), 4)
        np.testing.assert_array_equal(changed[10, 10], [0, 0, 240])
        np.testing.assert_array_equal(changed[10, 14], [40, 40, 40])
        np.testing.assert_array_equal(changed[7, 10], [40, 40, 40])
        covered = draw_image_sticker(background.copy(), sticker, (0, 0), 4, "cover")
        self.assertEqual(covered.shape, background.shape)
        np.testing.assert_array_equal(covered[-1, -1], background[-1, -1])
        np.testing.assert_array_equal(draw_frame(background.copy(), [], None, "custom", 4, sticker), background)

    def test_custom_export_keeps_every_frame_and_rejects_missing_artwork(self):
        cv2 = _opencv()
        import numpy as np
        source = self.synthetic_video()
        positions = self.csv_file([[0, 1, 15, 30, "test"], [11, 1, 37, 30, "test"]])
        sticker_path = self.folder / "sticker.png"
        cv2.imwrite(str(sticker_path), np.full((8, 12, 4), [0, 240, 0, 255], dtype=np.uint8))
        output = self.folder / "custom.mp4"
        report = render_video(source, positions, output, effect="custom", sticker_path=sticker_path)
        self.assertEqual(report["frames_written"], 12)
        self.assertEqual(report["visible_position_frames"], 2)
        decoded = cv2.VideoCapture(str(output))
        count = 0
        while decoded.read()[0]:
            count += 1
        decoded.release()
        self.assertEqual(count, 12)
        with self.assertRaises(ValueError):
            render_video(source, positions, self.folder / "invalid.mp4", effect="custom")
        self.assertFalse((self.folder / "invalid.mp4").exists())

    def test_rock_is_drawn_at_the_position_and_missing_position_draws_nothing(self):
        _opencv()
        import numpy as np
        original = np.zeros((100, 120, 3), dtype=np.uint8)
        changed = draw_frame(original.copy(), [], (60, 50), "rock", 22)
        self.assertTrue(changed[50, 60].any())
        self.assertFalse(changed[0, 0].any())
        np.testing.assert_array_equal(draw_frame(original.copy(), [], None, "rock", 22), original)

    def setUp(self):
        (ROOT / ".tmp").mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / ".tmp")
        self.folder = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def csv_file(self, rows):
        path = self.folder / "positions.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["Frame", "Visibility", "X", "Y", "Source"])
            writer.writerows(rows)
        return path

    def synthetic_video(self, count=12, fps=15):
        cv2 = _opencv()
        import numpy as np
        rng = random.Random(314)
        path = self.folder / "input.mp4"
        writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (96, 64))
        self.assertTrue(writer.isOpened())
        for index in range(count):
            image = np.full((64, 96, 3), rng.randrange(0, 5), dtype=np.uint8)
            cv2.circle(image, (15 + index * 2, 30), 11, (0, 128, 255), -1)
            writer.write(image)
        writer.release()
        return path

    def test_frame_keys_ignore_row_order_and_missing_frames(self):
        positions = load_positions(self.csv_file([[9, 1, 30, 20, "test"], [0, 1, 0, 0, "test"], [3, 0, "", "", "test"]]))
        self.assertEqual(position_at(positions, 0, 96, 64), (0, 0))
        self.assertEqual(position_at(positions, 9, 96, 64), (30, 20))
        self.assertIsNone(position_at(positions, 1, 96, 64))
        self.assertIsNone(position_at(positions, 3, 96, 64))

    def test_duplicate_nonfinite_and_outside_coordinates_are_rejected(self):
        for rows in ([[0, 0, "", "", "test"], [0, 0, "", "", "test"]], [[0, 1, "nan", 20, "test"]]):
            with self.assertRaises(ValueError):
                load_positions(self.csv_file(rows))
        positions = load_positions(self.csv_file([[0, 1, 100, 20, "test"]]))
        with self.assertRaises(ValueError):
            position_at(positions, 0, 96, 64)

    def test_missing_observation_breaks_lines_and_deque_discards_oldest(self):
        history = deque([(50, 20), None, (30, 20), (20, 20)], maxlen=4)
        self.assertEqual(trail_segments(history), [((30, 20), (20, 20))])
        history.appendleft((60, 20))
        self.assertEqual(list(history), [(60, 20), (50, 20), None, (30, 20)])
        self.assertEqual(trail_segments(history), [((60, 20), (50, 20))])

    def test_complete_video_survives_short_sparse_csv_and_preserves_clock(self):
        cv2 = _opencv()
        source = self.synthetic_video()
        positions = self.csv_file([[3, 1, 21, 30, "synthetic_test_seed314"], [0, 1, 15, 30, "synthetic_test_seed314"], [99, 1, 40, 30, "unused_test"]])
        output = self.folder / "output.mp4"
        frames = self.folder / "frames"
        report = render_video(source, positions, output, save_frames=frames)
        self.assertEqual(report["frames_written"], 12)
        self.assertEqual(report["visible_position_frames"], 2)
        self.assertEqual(report["missing_csv_rows"], 10)
        self.assertEqual(report["unused_csv_rows"], 1)
        self.assertEqual(report["fps"], 15)
        self.assertEqual(len(list(frames.glob("*.jpg"))), 12)
        decoded = cv2.VideoCapture(str(output))
        self.assertEqual(int(decoded.get(cv2.CAP_PROP_FRAME_COUNT)), 12)
        self.assertEqual(decoded.get(cv2.CAP_PROP_FPS), 15)
        self.assertEqual((decoded.get(cv2.CAP_PROP_FRAME_WIDTH), decoded.get(cv2.CAP_PROP_FRAME_HEIGHT)), (96, 64))
        count = 0
        while decoded.read()[0]:
            count += 1
        decoded.release()
        self.assertEqual(count, 12)

    def test_capture_effect_draws_only_when_current_position_exists(self):
        import numpy as np
        blank = np.zeros((64, 96, 3), dtype=np.uint8)
        self.assertFalse(draw_frame(blank.copy(), [], None, "capture").any())
        painted = draw_frame(blank.copy(), [(30, 30)], (30, 30), "capture", 10)
        self.assertTrue(painted[30, 30].max() > 200)
        self.assertFalse(painted[0, 0].any())

    def test_cannot_overwrite_source_video(self):
        source = self.synthetic_video(3)
        before = hashlib.sha256(source.read_bytes()).hexdigest()
        with self.assertRaises(ValueError):
            render_video(source, self.csv_file([]), source)
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), before)

    def test_simple_color_rule_measures_orange_and_ignores_red_paddle(self):
        cv2 = _opencv()
        import numpy as np
        image = np.zeros((96, 160, 3), dtype=np.uint8)
        cv2.circle(image, (115, 50), 30, (0, 0, 235), -1)
        cv2.circle(image, (35, 45), 14, (0, 128, 255), -1)
        center = orange_center(image)
        self.assertIsNotNone(center)
        self.assertLess(abs(center[0] - 35), 1)
        self.assertLess(abs(center[1] - 45), 1)
        self.assertIsNone(orange_center(np.zeros_like(image)))

    def test_color_measurement_writes_every_decoded_frame(self):
        source = self.synthetic_video(7)
        output = self.folder / "measured.csv"
        result = measure_video(source, output)
        rows = load_positions(output)
        self.assertEqual(result["frames"], 7)
        self.assertEqual(list(rows), list(range(7)))
        self.assertTrue(all(row.source == "color_component" for row in rows.values()))


if __name__ == "__main__":
    unittest.main()
