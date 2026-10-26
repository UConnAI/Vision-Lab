"""Read-only checks for the bundled Video Trails samples; no downloads or writes.

From take-home-code:
  python check_setup.py
  python check_setup.py --sample pingpong --decode

The default checks need only Python's standard library. --decode also checks the
installed OpenCV dependency and every decoded frame, without rendering an output.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

# Keep the preflight read-only even on a freshly copied workshop folder.
sys.dont_write_bytecode = True

from render_trail import _opencv, load_positions, position_at

ROOT = Path(__file__).resolve().parent
SAMPLES = ("soccer", "pingpong", "juggling")


def check_sample(sample="soccer", *, root=ROOT, decode=False, opencv_loader=_opencv):
    """Validate the chosen bundled video/CSV against its recorded provenance."""
    if sample not in SAMPLES:
        raise ValueError("Choose soccer, pingpong or juggling.")
    data = Path(root) / "data"
    manifest = data / "provenance.json"
    if not manifest.is_file():
        raise FileNotFoundError(f"Missing {manifest}. Use the complete workshop folder.")
    entry = json.loads(manifest.read_text(encoding="utf-8"))[sample]
    video = (data / entry["video"]).resolve()
    csv_path = (data / entry["positions"]).resolve()
    for path in (video, csv_path):
        if not path.is_file():
            raise FileNotFoundError(f"Missing {path}. Keep take-home-code beside take-home-football-tracker.")
    digest = hashlib.sha256()
    with video.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != entry["sha256"]:
        raise ValueError("The selected video does not match the bundled sample's recorded hash. Do not pair it with this sample CSV; restore the matching sample or use your own matching data.")
    positions = load_positions(csv_path)
    expected_frames = int(entry["frames"])
    if set(positions) != set(range(expected_frames)):
        raise ValueError(f"The bundled CSV must have exactly one row for each frame 0–{expected_frames - 1}. Missing observations use Visibility=0; do not delete those rows in the reference sample.")
    visible = sum(row.visible for row in positions.values())
    result = {"sample":sample, "video":str(video), "positions":str(csv_path),
              "video_hash_matches":True, "csv_rows":len(positions), "visible_rows":visible,
              "missing_rows":len(positions)-visible, "expected_fps":entry["fps"],
              "decoded_frames":None, "dimensions":None, "opencv_version":None}
    if not decode:
        return result
    cv2 = opencv_loader()
    capture = cv2.VideoCapture(str(video))
    try:
        if not capture.isOpened():
            raise RuntimeError("OpenCV could not open the sample video. Check this interpreter's video/codec installation.")
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not math.isfinite(fps) or abs(fps - entry["fps"]) > .01:
            raise ValueError(f"Decoded frame rate {fps} does not match the sample's {entry['fps']} fps.")
        count, size = 0, None
        while True:
            success, frame = capture.read()
            if not success:
                break
            height, width = frame.shape[:2]
            if size is not None and size != [width, height]:
                raise ValueError("Frame dimensions changed inside the sample video.")
            size = [width, height]
            position_at(positions, count, width, height)
            count += 1
        if count != expected_frames:
            raise ValueError(f"Decoded {count} frames, expected {expected_frames}. The file or decoder may be incomplete.")
        result.update(decoded_frames=count, dimensions=size, opencv_version=cv2.__version__)
        return result
    finally:
        capture.release()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sample", choices=SAMPLES, default="soccer")
    parser.add_argument("--decode", action="store_true", help="Read every video frame using OpenCV; still writes no output.")
    args = parser.parse_args(argv)
    print(f"Python: {sys.version.split()[0]}\nInterpreter: {sys.executable}")
    try:
        result = check_sample(args.sample, decode=args.decode)
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(f"CHECK FAILED: {error}", file=sys.stderr)
        return 1
    print(f"PASS: {result['sample']} video matches recorded SHA-256.")
    print(f"PASS: {result['csv_rows']} frame-keyed CSV rows; {result['visible_rows']} positions, {result['missing_rows']} gaps.")
    if args.decode:
        print(f"PASS: OpenCV {result['opencv_version']} decoded all {result['decoded_frames']} frames at {result['expected_fps']} fps, size {result['dimensions']}; supplied positions are in bounds.")
    else:
        print("NOT CHECKED: OpenCV, decoding and coordinate bounds. Run again with --decode to check them.")
    print("No files changed. Coordinate availability is not accuracy; the sample CSV contains estimates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
