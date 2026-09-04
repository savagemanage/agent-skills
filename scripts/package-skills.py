#!/usr/bin/env python3
"""Package each skill as a Claude.ai-ready zip: dist/<name>.zip → <name>/SKILL.md

Only git-tracked files are packaged, so runtime artifacts and dependencies that
are gitignored (node_modules/, .demo-recorder/, *.log, lockfiles, ...) never leak
into the upload. Developer-only assets (the test/ suite) are excluded from the
zip as well, since Claude.ai counts every file against a 25-file-per-skill limit.
"""
from __future__ import annotations

import subprocess
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"
DIST = ROOT / "dist"

# Top-level paths (relative to a skill dir, forward-slash form) kept out of the
# packaged zip. These are developer assets, not needed by the Claude.ai runtime.
EXCLUDE_PREFIXES = ("test/",)


def tracked_files(skill_dir: Path) -> list[Path]:
    """Return git-tracked files under skill_dir as absolute paths."""
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", str(skill_dir)],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    entries = result.stdout.decode("utf-8").split("\0")
    return [ROOT / entry for entry in entries if entry]


def is_excluded(rel: PurePosixPath) -> bool:
    rel_str = rel.as_posix()
    return any(rel_str == p.rstrip("/") or rel_str.startswith(p) for p in EXCLUDE_PREFIXES)


def package() -> None:
    DIST.mkdir(exist_ok=True)
    for old in DIST.glob("*.zip"):
        old.unlink()

    count = 0
    for skill_dir in sorted(SKILLS.iterdir()):
        if not skill_dir.is_dir() or not (skill_dir / "SKILL.md").exists():
            continue
        name = skill_dir.name
        out = DIST / f"{name}.zip"
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(tracked_files(skill_dir)):
                if not path.is_file():
                    continue
                rel = PurePosixPath(path.relative_to(skill_dir).as_posix())
                if is_excluded(rel):
                    continue
                # Archive root is the skill folder (required by Claude.ai)
                zf.write(path, str(PurePosixPath(name) / rel))
        print(f"Wrote {out.relative_to(ROOT)}")
        count += 1

    print(f"Packaged {count} skill(s) into dist/")


if __name__ == "__main__":
    package()
