# Ball Remix — optional CNN and appearance-tracking demo

Ball Remix is the optional detector/tracker comparison. The primary take-home code project is now [`../take-home-code/`](../take-home-code/README.md): a Python CSV/deque/OpenCV renderer. That renderer draws supplied coordinates; this browser demo is one way to obtain and inspect position estimates from video pixels. The two jobs are separate.

This demo runs pretrained COCO-SSD with MobileNetV1 by default, with MobileNetV2 available for comparison. It samples the **full video** at 10 Hz plus a safe final endpoint, associates accepted sports-ball observations and overlays a capture ball or your own artwork. It does not train a CNN. All files remain local; nothing is uploaded.

## Open the demo

With the main workshop launcher running, visit <http://127.0.0.1:4322/take-home-football-tracker/index.html>. The workshop starts at `start.html`; its six-stage route ends at the Python take-home page, which links to this optional comparison.

Standalone, run `python serve.py` from this folder on Windows, or `python3 serve.py` on Mac, then open <http://127.0.0.1:4324/index.html>. No pip/npm install is needed for the browser demo. Keep the server running; Ctrl+C stops it. The server binds only to this computer. Physical Mac validation has not been performed.

1. Choose one of the two visible video cards: **Soccer · one clear ball** or **Ping-pong · orange ball**. The older multiple-ball clip is no longer a selectable sample.
2. Click **Analyze full video**. The progress and coverage line report the analyzed range and the total duration. Initial CNN loading can take a moment.
3. Play, pause or scrub both views. The timeline reaches the end of the selected video, including the final partial sampling interval. Changing video clears the previous results and labels.
4. Compare the confidence threshold, appearance-tracking checkbox, smoothing and artwork size. You can also select a supported local video through **Your own video**.
5. Label centers or absent-ball samples, inspect the source counts, and export the numerical results. Use **Build the Python video project** for the primary portfolio code exercise.

## What each position means

- **CNN:** an accepted `sports ball` box from the selected pretrained detector. The original view shows returned detector boxes; yellow selected positions come from CNN observations or their playback interpolation.
- **Appearance tracker:** blue selected positions come from measured colored components in decoded frames. A color prototype is initialized from the central region of an accepted CNN box. It can help follow the orange ping-pong ball when the CNN misses, but needs matching visible pixels. Its quality score is not a CNN confidence or class probability.
- **Missing:** neither method supplies an accepted position. No replacement is drawn. A missing result can mean the ball is hidden/out of view or the methods failed; the count alone cannot distinguish those causes.
- **Interpolated/briefly held:** a calculated playback position between valid sampled observations, or the final short hold. It is not a new detector call. Interpolation does not cross a missing row and requires a neighboring gap no greater than 0.3 seconds.

Accepted CNN observations take priority. The confidence slider filters saved CNN boxes; appearance quality uses its own color/shape checks. Disable **Follow appearance when CNN misses** for a CNN-only comparison. Smoothing changes positions and can add lag. Replacement size changes only the artwork, not the measured box.

The appearance step is ordinary image processing, not another CNN. This is an offline analysis: once a suitable CNN anchor is available, matching can also be applied to cached earlier sampled images. It can confuse similar colors, miss small/blurred components or fail under changed appearance. Neither the detector nor the appearance helper establishes reliable tracking through every occlusion.

## Current local development observation — 2026-10-22

| Sample | Video duration | Final analyzed sample | CNN positions | Appearance positions | No position | Total samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| One soccer ball | 7.458008 s | 7.457008 s | 76 | 0 | 0 | 76 |
| Orange ping-pong ball | 6.583333 s | 6.582333 s | 6 | 18 | 43 | 67 |

These are measured source/availability counts from the current local browser run, not labeled detection accuracy. The ping-pong video includes partial visibility and out-of-frame intervals, and the detector can also miss a visible ball. The full duration was analyzed even where a position was unavailable. Earlier counts in `VERIFICATION.md` used the older endpoint sampling and CNN-only implementation; retain their dates when comparing.

## Media, outputs and limits

The active samples are `assets/single-ball.mp4` and `assets/ping-pong.mp4`, with preview thumbnails above the controls. Runtime scripts, model weights and media are bundled locally. The older multi-ball asset is retained for historical provenance and is not in the visible sample library. Credits, licenses and the media/model manifest remain in `ATTRIBUTION.md` and `assets/manifest.json`.

The CNN category is the broad `sports ball`, not a soccer-only identity model. Association starts with the largest accepted ball and then prefers the nearest candidate; identity can change. The effect is a 2D overlay rather than segmentation, depth reconstruction or inpainting. It can cover a foot or leave part of a poorly boxed ball visible.

Use human center labels, misses, false detections and identity mistakes to evaluate it. Coverage alone is not accuracy. JSON exports retain duration, analyzed range, method counts, raw detector output, appearance observations, trajectory and labels. A PNG snapshot saves one remix frame. This browser demo does not encode a video; the separate Python take-home renderer provides that workflow.

Preserve the samples' media licenses when sharing derived work. The Mixkit stock media license is separate from the application MIT license; the older multi-ball asset has its own CC BY-SA attribution. No new archive or deployment is required.

## Files and checks

- `app.mjs`: model loading, full-video sampling, effects and labeling UI.
- `timeline.mjs`: full-duration sample times and a safe near-end seek time; unreasonable allocations fail explicitly instead of truncating a video.
- `appearance.mjs`: measured color/shape prototype and component matching.
- `observations.mjs`: CNN/appearance priority and separate method counts.
- `tracking.mjs`: ball association, smoothing, interpolation and evaluation.
- `guide.html`: tracker implementation reference; the main code project is in `../take-home-code/`.

Run `node --test tests/*.test.mjs` from this folder. The current 19-test suite covers association, missing gaps, smoothing, full-duration endpoints, invalid input, appearance measurements/false matches and source counts. Node is needed only for tests, not the browser demo. Use seed 314 for any added random experiment. Keep work and outputs in the assigned project folder; the shared work log remains in the parent workspace's existing log file.

## Longer juggling sample and decoder handling

The recommended longer example is `assets/soccer-juggling.mp4`:14.416667seconds,346frames,960×540,24fps. It shows one ball being juggled with changing height and brief occlusion. Actual whole-clip sampling returned85CNN +48appearance +13missing positions over146timestamps. Coverage is availability, not labeled accuracy. Basketball remains an optional difficult comparison with many misses.

Offline analysis now waits for seeked and decoded pixels (readyState>=2), rather than requiring a fresh compositor callback. Identical black opening frames may not cause a new requestVideoFrameCallback presentation. The new video-frame module has tests for that case, missing decoded data, error handling and timeout.
