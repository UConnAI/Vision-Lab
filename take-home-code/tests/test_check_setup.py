import hashlib
import json
import shutil
import subprocess
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from check_setup import check_sample


class SetupChecks(unittest.TestCase):
    def setUp(self):
        temp_root = ROOT / "tmp"
        temp_root.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=temp_root)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "data").mkdir()
        self.video = self.root / "video.bin"
        self.video.write_bytes(b"synthetic video identity")
        self.csv = self.root / "data" / "soccer.csv"
        self.csv.write_text("Frame,Visibility,X,Y\n0,1,5,6\n1,0,,\n", encoding="utf-8")
        entry = {"video":"../video.bin", "positions":"soccer.csv", "frames":2, "fps":24,
                 "sha256":hashlib.sha256(self.video.read_bytes()).hexdigest()}
        (self.root / "data" / "provenance.json").write_text(json.dumps({"soccer":entry}), encoding="utf-8")

    def test_default_check_needs_no_decoder_and_writes_nothing(self):
        before={p.relative_to(self.root):p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        loader=Mock(side_effect=AssertionError("should not import OpenCV"))
        result=check_sample(root=self.root,opencv_loader=loader)
        self.assertEqual((result["csv_rows"],result["visible_rows"],result["missing_rows"]),(2,1,1))
        self.assertIsNone(result["decoded_frames"])
        self.assertEqual(before,{p.relative_to(self.root):p.read_bytes() for p in self.root.rglob("*") if p.is_file()})
        loader.assert_not_called()

    def test_wrong_video_and_missing_rows_fail_with_actionable_errors(self):
        self.video.write_bytes(b"wrong clip")
        with self.assertRaisesRegex(ValueError,"does not match"):
            check_sample(root=self.root)
        self.video.write_bytes(b"synthetic video identity")
        self.csv.write_text("Frame,Visibility,X,Y\n0,1,5,6\n",encoding="utf-8")
        with self.assertRaisesRegex(ValueError,"Visibility=0"):
            check_sample(root=self.root)

    def test_missing_file_explains_complete_folder_requirement(self):
        self.video.unlink()
        with self.assertRaisesRegex(FileNotFoundError,"beside take-home-football-tracker"):
            check_sample(root=self.root)

    def test_clean_copy_runs_without_site_packages_and_explains_missing_decoder(self):
        # -S removes site packages; -E ignores Python environment configuration.
        # Copy only the two scripts and synthetic assets, never local dependencies.
        for name in ("check_setup.py", "render_trail.py"):
            shutil.copyfile(ROOT / name, self.root / name)
        before={p.relative_to(self.root):p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        command=[sys.executable,"-E","-S",str(self.root / "check_setup.py")]
        checked=subprocess.run(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=30)
        self.assertEqual(checked.returncode,0,checked.stderr)
        self.assertIn("2 frame-keyed CSV rows; 1 positions, 1 gaps",checked.stdout)
        self.assertIn("NOT CHECKED: OpenCV",checked.stdout)
        failed=subprocess.run(command+["--decode"],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=30)
        self.assertEqual(failed.returncode,1)
        self.assertIn("python -m pip install -r requirements.txt",failed.stderr)
        self.assertNotIn("Traceback",failed.stderr)
        self.assertEqual(before,{p.relative_to(self.root):p.read_bytes() for p in self.root.rglob("*") if p.is_file()})

    def decoder(self,frames=2,fps=24,width=16,height=12):
        image=Mock();image.shape=(height,width,3)
        capture=Mock();capture.isOpened.return_value=True;capture.get.return_value=fps
        capture.read.side_effect=[(True,image)]*frames+[(False,None)]
        cv2=Mock();cv2.__version__="test";cv2.VideoCapture.return_value=capture
        return cv2,capture

    def test_decode_checks_every_frame_and_releases_capture(self):
        cv2,capture=self.decoder()
        result=check_sample(root=self.root,decode=True,opencv_loader=lambda:cv2)
        self.assertEqual(result["decoded_frames"],2);self.assertEqual(result["dimensions"],[16,12])
        capture.release.assert_called_once()

    def test_decode_rejects_bad_fps_truncation_and_out_of_bounds(self):
        for options,pattern in [({"fps":30},"frame rate"),({"frames":1},"Decoded 1"),({"width":4},"outside")]:
            with self.subTest(options=options):
                cv2,capture=self.decoder(**options)
                with self.assertRaisesRegex(ValueError,pattern):
                    check_sample(root=self.root,decode=True,opencv_loader=lambda:cv2)
                capture.release.assert_called_once()


if __name__ == "__main__":
    unittest.main()
