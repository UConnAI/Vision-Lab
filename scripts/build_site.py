"""Build only participant files for GitHub Pages. No credentials or downloads."""
from pathlib import Path
import importlib.util
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
EXCLUDED_DIRS = {".git", ".github", "_site", "tests", "scripts", "tmp", ".tmp", "__pycache__", ".python-deps", ".pip-cache", ".venv", "venv", "node_modules", ".build", "outputs", "recordings", "exports"}
PUBLIC_TEST_DOWNLOADS = {"tests/test_python_examples.py"}
PRIVATE_NAMES = {"instructor.md", "verification.md", "review-map.md", "overnight-review.md"}

def is_private(path):
    name = path.name.lower()
    return name in PRIVATE_NAMES or "walkthrough" in name or "presenter-private" in path.parts

def build():
    # Validate the resolved target before replacing our generated artifact.
    if OUTPUT.resolve().parent != ROOT.resolve() or OUTPUT.is_symlink():
        raise RuntimeError("Unexpected output location")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    copied = []
    for source in ROOT.rglob("*"):
        relative = source.relative_to(ROOT)
        if not source.is_file() or any(part in EXCLUDED_DIRS for part in relative.parts) and relative.as_posix() not in PUBLIC_TEST_DOWNLOADS:
            continue
        if is_private(relative):
            raise RuntimeError(f"Private material found in participant source: {relative}")
        if source.suffix.lower() in {".zip", ".pyc", ".pyd", ".dll", ".pem", ".key"} or source.name.startswith(".env"):
            continue
        if len(relative.parts) == 1 and source.suffix not in {".html", ".mjs", ".css", ".json"}:
            continue
        target = OUTPUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        copied.append(relative)
    (OUTPUT / ".nojekyll").touch()
    spec = importlib.util.spec_from_file_location("links", ROOT / "check_local_links.py")
    links = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(links)
    result = links.audit(OUTPUT)
    if result["errors"]:
        raise RuntimeError("\n".join(result["errors"]))
    assert not any(is_private(p) for p in OUTPUT.rglob("*"))
    print(f"Built {len(copied)} participant files; {result['html_pages']} HTML pages, zero missing dependencies; no private walkthrough/instructor files.")

if __name__ == "__main__":
    build()
