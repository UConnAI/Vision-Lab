"""Offline participant-page dependency audit. Reads files; never makes requests.

Checks linked HTML pages/anchors, src/poster assets, CSS URLs, static relative
module imports, import.meta.url assets and the declared runtime sample files.
Dynamic application behavior and external URLs require separate verification.
Run from any directory: python path/to/vision-lab-cnn/check_local_links.py
"""
from collections import deque
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
PAGES = ("start.html", "lecture.html", "explore.html", "index.html", "take-home-code/index.html")
RUNTIME = (
    "vendor/gesture_recognizer.task", "vendor/vision_bundle.mjs",
    "vendor/wasm/vision_wasm_internal.js", "vendor/wasm/vision_wasm_internal.wasm",
    "vendor/wasm/vision_wasm_nosimd_internal.js", "vendor/wasm/vision_wasm_nosimd_internal.wasm",
    "prompts.json",
    "take-home-football-tracker/vendor/model/model.json",
    "take-home-football-tracker/vendor/model-v1/model.json",
)


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.references = set(), []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        for name in ("href", "src", "poster"):
            if attrs.get(name):
                self.references.append(attrs[name])


def audit(root=ROOT):
    root = Path(root).resolve()
    pending = deque(root / name for name in PAGES)
    scanned, assets, external, errors = set(), set(), set(), []
    pages = {}
    reference_count = 0

    def read_page(path):
        if path not in pages:
            pages[path] = Page(path.read_text(encoding="utf-8-sig"))
        return pages[path]

    def reference(source, value):
        nonlocal reference_count
        if not value or value.startswith(("data:", "blob:", "javascript:")):
            return
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc:
            external.add(value)
            return
        reference_count += 1
        decoded = unquote(parsed.path)
        target = ((root / decoded.lstrip("/")) if decoded.startswith("/") else source.parent / decoded).resolve() if decoded else source
        if not target.is_relative_to(root):
            errors.append(f"{source.relative_to(root)} -> {value}: outside workshop root")
            return
        if not target.exists():
            errors.append(f"{source.relative_to(root)} -> {value}: missing")
            return
        assets.add(target)
        if target.suffix.lower() in (".html", ".htm") and target.is_file():
            if parsed.fragment and unquote(parsed.fragment) not in read_page(target).ids:
                errors.append(f"{source.relative_to(root)} -> {value}: missing static anchor")
        if target.suffix.lower() in (".html", ".htm", ".css", ".mjs") and target.is_file():
            pending.append(target)

    # Model/WASM selection and sample lookup happen dynamically in the browser.
    for name in RUNTIME:
        reference(root / "index.html", name)
        if name.endswith("/model.json") and (root / name).is_file():
            model_path = root / name
            model = json.loads(model_path.read_text(encoding="utf-8"))
            for group in model.get("weightsManifest", []):
                for shard in group["paths"]:
                    reference(model_path, shard)
    manifest = root / "take-home-code/data/provenance.json"
    reference(root / "index.html", str(manifest.relative_to(root)).replace("\\", "/"))
    if manifest.is_file():
        for sample in json.loads(manifest.read_text(encoding="utf-8")).values():
            if not isinstance(sample, dict) or "video" not in sample:
                continue
            for key in ("video", "positions", "sourceMeasurements"):
                if sample.get(key):
                    reference(manifest, sample[key])

    while pending:
        source = pending.popleft()
        if source in scanned:
            continue
        scanned.add(source)
        if not source.is_file():
            errors.append(f"{source.relative_to(root)}: missing entry page")
            continue
        suffix = source.suffix.lower()
        if suffix in (".html", ".htm"):
            refs = read_page(source).references
        else:
            text = source.read_text(encoding="utf-8-sig")
            if suffix == ".css":
                refs = re.findall(r"url\(\s*['\"]?([^'\")\s]+)", text)
                refs += re.findall(r"@import\s+['\"]([^'\"]+)", text)
            else:
                refs = re.findall(r"\bfrom\s*['\"](\.[^'\"]+)['\"]", text)
                refs += re.findall(r"\bimport\s*(?:\(\s*)?['\"](\.[^'\"]+)['\"]", text)
                refs += re.findall(r"new URL\(\s*['\"]([^'\"]+)['\"]\s*,\s*import\.meta\.url", text)
        for ref in refs:
            reference(source, ref)
    return {"html_pages": len(pages), "scanned_sources": len(scanned),
            "local_references": reference_count, "existing_local_targets": len(assets),
            "external_urls_not_requested": sorted(external), "errors": errors}


if __name__ == "__main__":
    result = audit()
    print(json.dumps(result, indent=2))
    print("Offline static check only: no external URLs requested; no browser interaction, dynamic fetch, camera, model execution or downloads tested.")
    raise SystemExit(bool(result["errors"]))
