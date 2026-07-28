# Project notes for Claude

## Documentation language

- `README.md` is **English only**. Describe skills (including `gov-one-pager`) in English in the skills table and body.
- Korean user-facing docs live in `README.ko.md`.
- **Always** update `README.ko.md` in the same change whenever you edit `README.md` (skills table, install steps, links, or any other user-facing content). Do not leave the Korean README stale.
- Cross-link the two READMEs near the top of each file.
- Skill folders (`skills/*/SKILL.md`) may use Korean or English as needed for the skill’s audience. Do not rely on the English README to carry Korean trigger phrases; put those in the skill itself and/or `README.ko.md`.

## Packaging for Claude.ai

After changing a skill, run `python scripts/package-skills.py` so `dist/<name>.zip` stays current. Claude.ai skill `description` fields must be ≤ 200 characters.
