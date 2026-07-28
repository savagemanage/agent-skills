# Claude Skills

Open-source [Agent Skills](https://agentskills.io/) for Claude: folders of instructions and scripts that Claude loads when a task matches.

Copyright 2026 Janghoon Lee. **License:** [Apache-2.0](./LICENSE)

## Skills

| Skill | Use when | Output |
| --- | --- | --- |
| [gov-one-pager](./skills/gov-one-pager/) | Korean 정부지원 사업 요약서 / 추진계획(안) / 1페이지 요약서 | A4 `.docx` |
| [exec-one-pager](./skills/exec-one-pager/) | English exec, pitch, or startup one-pager | Letter `.docx` |

These are different formats. Generic English “one-pager” → `exec-one-pager`. Korean government proposal table → `gov-one-pager`.

## Install

**Claude Code** — copy into the project:

```bash
mkdir -p .claude/skills
cp -r skills/gov-one-pager skills/exec-one-pager .claude/skills/
```

Or symlink everything:

```bash
ln -s /path/to/claude-skills/skills/* .claude/skills/
```

**Claude.ai** — zip a skill folder and upload as a custom skill ([docs](https://support.claude.com/en/articles/12512180-using-skills-in-claude)).

Both one-pager skills need Node.js and `docx` (`npm install docx`) when generating the file.

## Add a skill

1. Copy [`template/`](./template/) to `skills/<name>/`
2. Set `name` + `description` (what + when), write instructions
3. Update the table above
4. See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Links

- [Agent Skills](https://agentskills.io/)
- [Creating custom skills](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [anthropics/skills](https://github.com/anthropics/skills)
