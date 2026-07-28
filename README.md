# Claude Skills

Open-source [Agent Skills](https://agentskills.io/) for Claude: folders of instructions and scripts that Claude loads when a task matches.

Copyright 2026 Janghoon Lee. **License:** [Apache-2.0](./LICENSE)

[한국어 README](./README.ko.md)

## Skills

| Skill | Use when | Claude.ai zip |
| --- | --- | --- |
| [gov-one-pager](./skills/gov-one-pager/) | Korean government-style one-page project summary (grant / proposal table format) | [Download](./dist/gov-one-pager.zip) |
| [exec-one-pager](./skills/exec-one-pager/) | English exec, pitch, or startup one-pager | [Download](./dist/exec-one-pager.zip) |

These are different formats. Generic English “one-pager” → `exec-one-pager`. Korean government proposal table → `gov-one-pager`.

## Install on Claude.ai

1. Download a skill zip from the table above (or from [`dist/`](./dist/)).
2. Open [claude.ai](https://claude.com/) → **Settings** → **Capabilities** / **Skills** (wording varies) → **Upload skill**.
3. Select the `.zip` file.

Each zip already has the correct layout (`skill-name/SKILL.md` at the archive root). See [Using skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude).

One-pager skills need Node.js and `docx` (`npm install docx`) when Claude generates the `.docx`.

## Install in Claude Code

```bash
mkdir -p .claude/skills
cp -r skills/gov-one-pager skills/exec-one-pager .claude/skills/
```

Or symlink everything:

```bash
ln -s /path/to/claude-skills/skills/* .claude/skills/
```

## Add a skill

1. Copy [`template/`](./template/) to `skills/<name>/`
2. Set `name` + `description` (what + when; keep description ≤ **200** characters for Claude.ai)
3. Run `python scripts/package-skills.py` (or `bash scripts/package-skills.sh`) to refresh `dist/<name>.zip`
4. Update the skills table in this README and in [`README.ko.md`](./README.ko.md)
5. See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Links

- [Agent Skills](https://agentskills.io/)
- [Creating custom skills](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [anthropics/skills](https://github.com/anthropics/skills)
