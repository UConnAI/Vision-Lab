"""Download pinned public runtime/model assets into this workshop only."""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent / 'vendor'
VERSION = '0.10.22-rc.20250304'
BASE = f'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@{VERSION}'
ASSETS = {'vision_bundle.mjs': f'{BASE}/vision_bundle.mjs',
          'README.md': f'{BASE}/README.md',
          'LICENSE': 'https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE',
          'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'}
ASSETS['gesture_recognizer.task']='https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
for name in ('vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'):
    ASSETS['wasm/' + name] = f'{BASE}/wasm/{name}'

if __name__ == '__main__':
    manifest = {'package': '@mediapipe/tasks-vision', 'version': VERSION, 'assets': []}
    for name, url in ASSETS.items():
        path = ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f'Downloading {name}', flush=True)
        with urllib.request.urlopen(url, timeout=90) as response:
            data = response.read()
        path.write_bytes(data)
        manifest['assets'].append({'path': name, 'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
