# Agent Skills

A small, open-source collection of [Agent Skills](https://agentskills.io/): folders of instructions and scripts that a compatible agent tool loads on demand when a task matches. Agent Skills is an open standard, so the skills here work across coding agents such as Kiro, Claude Code, and opencode, and several also ship as Claude.ai upload zips.

[한국어 README](./README.ko.md)

## Contents

- [Skills](#skills)
- [Getting started](#getting-started)
- [Usage](#usage)
  - [Claude.ai (zip upload)](#claudeai-zip-upload)
  - [Coding agents (Claude Code, Kiro, opencode)](#coding-agents-claude-code-kiro-opencode)
- [Contributing](#contributing)
- [Links](#links)
- [License](#license)

## Skills

| Skill | Use when | Claude.ai zip |
| --- | --- | --- |
| [gov-one-pager](./skills/gov-one-pager/) | Korean government-style one-page project summary (grant / proposal table format) | [Download](./dist/gov-one-pager.zip) |
| [exec-one-pager](./skills/exec-one-pager/) | English exec, pitch, or startup one-pager | [Download](./dist/exec-one-pager.zip) |
| [voice](./skills/voice/) | Janghoon Lee Korean voice for docs, Slack, email, PDF | [Download](./dist/voice.zip) |
| [demo-recorder](./skills/demo-recorder/) | Record a watchable demo video of a web app (visible cursor, slow motion) and verify a UI click-through | [Download](./dist/demo-recorder.zip) |

These are different formats, so pick by what you are producing. Generic English "one-pager" → `exec-one-pager`. Korean government proposal table → `gov-one-pager`. Korean business tone → `voice`. Recorded UI demo video or click-through check → `demo-recorder`.

## Getting started

Each skill is a self-contained folder under [`skills/`](./skills/). There is nothing to build for the document skills: choose an install target below, then let your agent load the skill when a task matches its description.

- Using Claude.ai in the browser? Upload the skill zip (see [Claude.ai (zip upload)](#claudeai-zip-upload)).
- Using a coding agent (Claude Code, Kiro, opencode)? Drop the skill folder where the agent discovers it (see [Coding agents](#coding-agents-claude-code-kiro-opencode)).
- Want the `demo-recorder` skill? It drives a real browser and needs a few extra steps; see its [SKILL.md](./skills/demo-recorder/SKILL.md).

## Usage

### Claude.ai (zip upload)

1. Download a skill zip from the [Skills](#skills) table above (or from [`dist/`](./dist/)).
2. Open [claude.ai](https://claude.com/) → **Settings** → **Capabilities** / **Skills** (wording varies) → **Upload skill**.
3. Select the `.zip` file.

Each zip already has the correct layout (`skill-name/SKILL.md` at the archive root). See [Using skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude).

The one-pager skills need Node.js and `docx` (`npm install docx`) when Claude generates the `.docx`.

### Coding agents (Claude Code, Kiro, opencode)

The same skill folders work across tools; only the discovery directory differs. For Claude Code, copy them into `.claude/skills`:

```bash
mkdir -p .claude/skills
cp -r skills/gov-one-pager skills/exec-one-pager skills/voice .claude/skills/
```

Or symlink everything:

```bash
ln -s /path/to/claude-skills/skills/* .claude/skills/
```

Other tools read from their own directory: Kiro uses `.kiro/skills`, opencode uses `.opencode/skills` (and also reads `.claude/skills` and `.agents/skills`). Use the matching path (for example `.kiro/skills`) instead of `.claude/skills`. The `demo-recorder` skill also bundles a cross-tool installer that writes into all of these at once; see its [SKILL.md](./skills/demo-recorder/SKILL.md).

## Contributing

Contributions of new skills and improvements are welcome. To add a skill:

1. Copy [`template/`](./template/) to `skills/<name>/`
2. Set `name` + `description` (what + when; keep description ≤ **200** characters for Claude.ai)
3. Run `python scripts/package-skills.py` (or `bash scripts/package-skills.sh`) to refresh `dist/<name>.zip`
4. Update the skills table in this README and in [`README.ko.md`](./README.ko.md)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guidelines, including the rule that README.md and README.ko.md must stay in sync.

## Links

- [Agent Skills](https://agentskills.io/)
- [Creating custom skills](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [anthropics/skills](https://github.com/anthropics/skills)

## License

Copyright 2026 Janghoon Lee (이장훈). Released under the [Apache-2.0](./LICENSE) license.
