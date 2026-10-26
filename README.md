# Vision Lab — UConn AI Club

[Open the workshop](https://uconnai.github.io/Vision-Lab/start.html)

Explore image filters, train a small CNN, inspect forward and backward calculations, play with hand tracking, and build a Python video effect. The live demo runs in the browser. Camera processing stays on the device.

## Workshop route

Exercises → Lecture → Playground → Go deeper → Final challenge → Take-home.

The first page is `start.html`. The repository root `index.html` is the final rock–paper–scissors game; use the workshop link above to begin with the exercises.

## Run locally on Windows or Mac

Run `python serve.py` on Windows or `python3 serve.py` on Mac. Open the URL printed by the launcher. Keep the complete folder together. The browser demo needs no pip/npm installation. The optional Python take-home renderer has its own requirements file.

For camera use, allow browser camera access over HTTPS or localhost. Mouse, touch, generated-image and illustrated practice activities remain available without a camera.

## Code and attribution

Python examples are in `python/` and `take-home-code/`. Preserve vendor license notices, photo provenance in `references/photo-bank-provenance.json`, and video source/license links in the take-home pages. Bundled pretrained models are third-party inference assets; the symbol CNN is trained locally in the browser.
