# Claude Skills

Open-source [Agent Skills](https://agentskills.io/) for Claude: folders of instructions and scripts that Claude loads when a task matches.

Copyright 2026 Janghoon Lee (이장훈). **License:** [Apache-2.0](./LICENSE)

[한국어 README](./README.ko.md)

## Skills

| Skill | Use when | Claude.ai zip |
| --- | --- | --- |
| [gov-one-pager](./skills/gov-one-pager/) | Korean government-style one-page project summary (grant / proposal table format) | [Download](./dist/gov-one-pager.zip) |
| [exec-one-pager](./skills/exec-one-pager/) | English exec, pitch, or startup one-pager | [Download](./dist/exec-one-pager.zip) |
| [voice](./skills/voice/) | Janghoon Lee Korean voice for docs, Slack, email, PDF | [Download](./dist/voice.zip) |
| [demo-recorder](./skills/demo-recorder/) | Record a watchable demo video of a web app (visible cursor, slow motion) and verify a UI click-through | [Download](./dist/demo-recorder.zip) |

These are different formats. Generic English “one-pager” → `exec-one-pager`. Korean government proposal table → `gov-one-pager`. Korean business tone → `voice`. Recorded UI demo video / click-through check → `demo-recorder`.

## Install on Claude.ai

1. Download a skill zip from the table above (or from [`dist/`](./dist/)).
2. Open [claude.ai](https://claude.com/) → **Settings** → **Capabilities** / **Skills** (wording varies) → **Upload skill**.
3. Select the `.zip` file.

Each zip already has the correct layout (`skill-name/SKILL.md` at the archive root). See [Using skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude).

One-pager skills need Node.js and `docx` (`npm install docx`) when Claude generates the `.docx`.

## Install in Claude Code

```bash
mkdir -p .claude/skills
cp -r skills/gov-one-pager skills/exec-one-pager skills/voice .claude/skills/
```

Or symlink everything:

```bash
ln -s /path/to/claude-skills/skills/* .claude/skills/
```

## Install demo-recorder

`demo-recorder` runs a real browser, so it needs a couple of extra steps beyond copying the folder.

**Prerequisites:** Node.js 18+ (22 recommended). No system `ffmpeg` is needed; the skill bundles one via `ffmpeg-static`.

1. Put the skill where your tool discovers it (pick one):

   ```bash
   # Claude Code (project-local)
   mkdir -p .claude/skills
   cp -r skills/demo-recorder .claude/skills/

   # or symlink it
   ln -s "$(pwd)/skills/demo-recorder" .claude/skills/demo-recorder

   # or use the built-in cross-tool installer (Kiro / Claude Code / opencode)
   node skills/demo-recorder/scripts/install-skill.mjs            # symlink into ./.kiro ./.claude ./.opencode
   node skills/demo-recorder/scripts/install-skill.mjs --global   # into ~/.kiro ~/.claude ~/.config/opencode
   ```

2. Install the runtime dependencies once, in the skill folder:

   ```bash
   cd skills/demo-recorder
   npm install
   ```

3. Install a Chromium browser for Playwright once:

   ```bash
   npx playwright install chromium
   ```

   If your machine keeps browsers in a shared, pre-provisioned directory, point Playwright at it instead of downloading a new one:

   ```bash
   export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright   # set this before every run
   ```

4. Record a demo (the bundled calculator example):

   ```bash
   cd skills/demo-recorder
   node scripts/demo-run.mjs --config examples/calculator/demo.config.json
   node scripts/review.mjs                     # writes review-report.md, prints PASS/FAIL
   ```

   Slow it down or hide the cursor from the command line:

   ```bash
   node scripts/demo-run.mjs --config examples/calculator/demo.config.json --slow 1200 --slow-mo 400
   node scripts/demo-run.mjs --config examples/calculator/demo.config.json --no-cursor
   ```

The deliverable video is `demo.mp4` (H.264) under the run's `video/` directory; `demo.webm` is kept as the source recording. Runtime output lands in `.demo-recorder/artifacts/` by default (override with `DEMO_RECORDER_ARTIFACTS_ROOT`).

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
