# Video Trails — a Python code project

This project uses a CSV, a deque and a frame loop to create video effects. It draws coordinates that have already been supplied. It does not run a detector inside the renderer.

Open the local page at `http://127.0.0.1:4322/take-home-code/index.html` while the workshop server is running. The page previews the same frame-keyed CSV logic over the original video. Nothing is uploaded. The interactive browser demo needs no notebook download. The Python files are for editing and running the implementation in a Python environment.

## Choose a starting route

- **Browser first:** keep the workshop server running and open this page. No Python packages, notebook or camera are needed for the default CSV preview. Start with the guided route, change one setting, and record what changed.
- **Python renderer:** Python 3.10+, a terminal, and the complete workshop folder are needed. The neighboring `take-home-football-tracker/assets` folder supplies the videos. The renderer uses OpenCV, not a trained model.
- **Optional CNN extension:** requires the additional dependencies and a separate learning/evaluation experiment. Finish the CSV rendering loop first.

### Check the local sample before you render

Open a terminal in `take-home-code` and run:

```powershell
python --version
python check_setup.py
```

The read-only check prints the interpreter path, verifies the selected video's SHA-256 against its recorded provenance, and checks every frame-keyed CSV row. For the default soccer clip, expect **179 rows, 179 supplied positions, 0 gaps**. This default check uses only the standard library; it deliberately says video decoding has not yet been checked. It does not install, download, render, or modify anything.

After installing the requirements with the same interpreter used to run the program:

```powershell
python -m pip install -r requirements.txt
python check_setup.py --decode
```

Expect **179 decoded frames, 24 fps, 960 × 540** and positions inside the frame. Use `--sample pingpong` or `--sample juggling` to check the other visible sample cards. A missing-position row is valid; the decoder should still process that frame. The bundled-sample check requires a row for every frame because those reference CSVs are complete; the renderer itself also accepts sparse custom CSVs.

Use `python3` consistently on macOS if that is your interpreter command. If you prefer an isolated environment, create one with `python -m venv .venv`, then use its Python executable for **both** installation and execution (`.venv\Scripts\python.exe` on Windows; `.venv/bin/python` on macOS/Linux). No activation or shell-policy change is necessary.

If the wrong video is paired with a CSV, the hash check explains the mismatch. If `cv2` is unavailable, install the supplied requirements in the interpreter printed at the top. If decoding stops early or coordinates fall outside the frame, fix that input/decoder problem before interpreting the output as a tracking result.

## Start with the code

1. Open `starter.ipynb` from this folder. It contains English explanations and five TODO exercises.
2. Install the video dependency in your Python environment:

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. Run the complete reference:

   ```powershell
   python render_trail.py --video ../take-home-football-tracker/assets/single-ball.mp4 --positions data/soccer.csv --output outputs/soccer-trail.mp4 --trail-length 8
   ```

4. Try the ping-pong clip:

   ```powershell
   python render_trail.py --video ../take-home-football-tracker/assets/ping-pong.mp4 --positions data/ping-pong.csv --output outputs/ping-pong-trail.mp4 --effect capture
   ```

Use `python3` on macOS. The reference supports `--radius`, `--save-frames`, and a four-character `--codec`. The tested default is `mp4v`; browser support for re-encoded MPEG-4 video can differ, so inspect the file in a local video player. The browser preview uses the original H.264 video and canvas instead of this encoder.

## Data contract

Required columns are `Frame,Visibility,X,Y`. Frame numbers start at zero. Coordinates use the original video dimensions, with the top-left corner as origin. `Visibility=0` permits blank coordinates. Extra fields such as `Source` are allowed.

The loader uses a dictionary keyed by Frame, so row order does not matter. Duplicate frames and invalid visible coordinates are rejected. Missing frames produce `None` in a bounded deque; line segments cannot bridge a missing observation. The renderer processes every decoded video frame even when the CSV is shorter than the video. It preserves the original frame rate and dimensions.

`data/schema-example.csv` contains invented rows demonstrating the schema only. It is not a set of positions for the videos.

## Coordinate provenance

- `data/soccer.csv`: 179 frame-keyed rows for the 179-frame, 24 fps, 960×540 single-ball video. Coordinates were derived from 76 actual sampled detections in the separate local CNN demo, using its existing interpolation function to reach the original frame clock. Source identifies sampled detections versus interpolation/brief hold. The original sampled trajectory is retained in `data/soccer-source-measurements.json`.
- `data/ping-pong.csv`: 158 frame-keyed rows for the 158-frame, 24 fps, 960×540 orange-ball video. `measure_orange_ball.py` processes each decoded frame with color/component rules. The measured file has 69 position estimates and 89 missing estimates. These counts are availability, not accuracy.
- Both coordinate files are estimates, not manual ground truth. See `data/provenance.json` for video hashes, method details and source links.
- The videos are used by relative path from the existing `take-home-football-tracker/assets` folder; no extra video copy is included. Their credits and licenses remain in that project's `ATTRIBUTION.md`.

## Optional simple coordinate generator

```powershell
python measure_orange_ball.py --video ../take-home-football-tracker/assets/ping-pong.mp4 --output outputs/my-ping-pong.csv
```

This is a color/shape rule for an orange ball. It can confuse similar colors and loses the object when hidden or outside the image. It is a useful comparison with manual coordinates or a model, not an assurance of equivalent performance across videos.

## Checks

```powershell
python -m unittest discover -s tests -p "test_*.py"
node --test tests/*.test.mjs
```

The tests use a generated seed-314 video inside this project folder. They check full-video output with sparse/out-of-order/short CSVs, missing observations, preserved frame count/FPS, drawing, source-file protection, color measurements, and CSV parsing. Node is only needed for the browser CSV tests.

An optional project-local `.python-deps` directory is recognized by the reference scripts for development; ordinary participants can install the pinned requirement in their own environment.

## Stickers and three small CNNs

The browser demo now offers a rock sticker, capture ball and trail, with an artwork-size slider. The default CSV mode remains independent from a model. Use `--effect rock --radius 105` in render_trail.py for the same illustrated rock in Python output. It is a 2D overlay, not object removal or inpainting.

The recommended longer soccer-juggling option is 14.416667 seconds / 346 frames at 24 fps. It contains one ball, repeated kicks, changing height and brief occlusion. Supplied coordinates come from actual MobileNetV1 + SSD samples and CNN-seeded appearance measurements, with explicitly marked interpolation and missing positions. These are noisy estimates, not manual labels. It adds more movement than the short soccer example. Of 146 sampled times, 85 have CNN positions, 48 have appearance positions and 13 are missing. The frame-keyed CSV contains 297 positions and 49 gaps across 346 frames.

Train three tiny center regressors directly in the browser: one convolution (1,266 parameters), two convolutions (922), and a wider two-layer model (1,870). Input is 32×18 RGB. All models use the same chronological 60/20/20 visible-frame split, seed 314, Adam 0.005 and validation-based epoch selection. Compare test center error with the training-mean baseline, then select a trained model under Position source. A center regressor always outputs a point, even on absent frames; it is not a visibility detector. The scores measure agreement with supplied CSV estimates from this clip, not independent tracking accuracy or generalization. Models are cleared when the clip, CSV or frame rate changes.

Python counterpart (optional PyTorch dependency):

```powershell
python -m pip install -r requirements.txt -r requirements-cnn.txt
python tiny_cnn.py --video ../take-home-football-tracker/assets/single-ball.mp4 --positions data/soccer.csv --epochs 20
```

The architectures and parameter counts match the browser models; initialization, decoding, optimizer arithmetic and exact results can differ between PyTorch and TensorFlow.js. If a CSV frame is outside the video, the browser stops with a matching-video/CSV/frame-rate message. The Python version also stops if the decoder cannot seek to the requested frame. Fix that alignment before training; substituting the last readable image would teach the wrong pairing.

## Upload an image sticker

Use Upload your sticker in the browser preview. A successfully decoded PNG/JPEG/WebP/SVG automatically selects My image sticker. Transparent PNG preserves the video underneath transparent areas. Image fit chooses either the complete image at its original aspect ratio or a centered square crop. Change Artwork radius to cover the ball. The image is local to this browser session and follows the selected CSV or CNN position; a missing CSV position adds no new sticker.

Python supports PNG/JPEG/WebP, including alpha transparency:

```powershell
python render_trail.py --video ../take-home-football-tracker/assets/single-ball.mp4 --positions data/soccer.csv --output outputs/my-sticker.mp4 --effect custom --sticker my-sticker.png --sticker-fit contain --radius 200
```

Use python3 on macOS. Replace contain with cover to crop to a square. This is a 2D overlay: opaque image regions cover pixels; it does not remove or reconstruct the ball.
