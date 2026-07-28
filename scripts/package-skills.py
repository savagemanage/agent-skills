#!/usr/bin/env python3
"""Package each skill as a Claude.ai-ready zip: dist/<name>.zip → <name>/SKILL.md"""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"
DIST = ROOT / "dist"


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
            for path in sorted(skill_dir.rglob("*")):
                if path.is_file():
                    # Archive root is the skill folder (required by Claude.ai)
                    zf.write(path, Path(name) / path.relative_to(skill_dir))
        print(f"Wrote {out.relative_to(ROOT)}")
        count += 1

    print(f"Packaged {count} skill(s) into dist/")


if __name__ == "__main__":
    package()
