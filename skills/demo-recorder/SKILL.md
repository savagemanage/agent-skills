---
name: demo-recorder
description: Drives a web app in a headless browser with a visible cursor and slow-motion delays, records a real demo video (WebM and mp4), then reviews it. Use to make a watchable UI demo or check a flow.
license: Apache-2.0
---

# demo-recorder

demo-recorder turns "does this product actually work when you click through it?" into an automated, reviewable loop that also produces a **watchable demo video**. It launches the app, drives it in a **headless** Chromium browser, records a **real video** of the run, and captures per-step screenshots, accessibility snapshots, and a structured action log. You then review those artifacts to judge PASS/FAIL, find the failing step, fix the product code, and re-run until it passes.

To make the recording easy for a human to follow it (1) inserts a configurable **pause between steps**, (2) runs Playwright in **slow motion** so each action is visibly slower, and (3) injects a **visible mouse cursor** that glides to each control before clicking (headless Chromium has no OS cursor).

Playwright records the session natively as a genuine WebM screen recording (its context video recording), not a slideshow of screenshots. After the run, demo-recorder transcodes that WebM to an **H.264 `.mp4`** with ffmpeg. **The `.mp4` is the primary deliverable video to show and report to the user; the WebM is kept as the source recording.**

## Prerequisites

- Node.js 22+.
- Install the skill's dependencies once from the skill directory: `npm install` (this installs `playwright` and `ffmpeg-static`).
- Install a Chromium browser for Playwright once: `npx playwright install chromium`.
- **Set `PLAYWRIGHT_BROWSERS_PATH`** if your environment keeps browsers in a shared, pre-provisioned directory (for example `export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright`). Point it at the directory that already contains the matching Chromium build so Playwright reuses it instead of re-downloading.
- Headless only (no display server): the engine forces `headless: true` with `--no-sandbox`. The visible-cursor overlay is how the pointer is made visible under headless.
- **ffmpeg is required to produce the `.mp4`.** The skill depends on the [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static) npm package (installed by `npm install`), which bundles an H.264-capable ffmpeg, so no system ffmpeg is needed. To use a different binary, set `DEMO_RECORDER_FFMPEG` to its absolute path; the resolver then falls back to `ffmpeg-static`, then Playwright's bundled ffmpeg, then `ffmpeg` on `PATH`. If no ffmpeg is found (or the transcode fails), the run is **not** aborted: the real WebM is kept and the report notes that mp4 was skipped.

## The loop

Run these steps from the skill directory (the one containing `scripts/`), or point `--config` at any config path.

### 1. Write (or point to) a `demo.config.json`

The config describes how to launch the target, where it lives, and the click-through scenario.

```json
{
  "name": "calculator",
  "launch": {
    "command": "node server.mjs 4600",
    "cwd": ".",
    "readyLog": "listening on",
    "timeoutMs": 15000
  },
  "baseUrl": "http://127.0.0.1:4600",
  "viewport": { "width": 1280, "height": 720 },
  "stepDelayMs": 800,
  "slowMo": 300,
  "showCursor": true,
  "scenario": [
    { "action": "goto", "url": "/" },
    { "action": "click", "selector": "#key-7" },
    { "action": "click", "selector": "#op-add" },
    { "action": "click", "selector": "#key-8" },
    { "action": "click", "selector": "#key-equals" },
    { "action": "expectText", "selector": "#display", "text": "15" }
  ]
}
```

**Top-level fields**

- `name` (required): human name; used to slug the run's artifact directory.
- `baseUrl` (required): the URL the app is served at (e.g. `http://127.0.0.1:4600`). Scenario `goto` URLs can be relative to this.
- `launch` (optional): how to start the app. Omit it if the app is already running / external.
  - `command` (required): shell command to start the app (e.g. `node server.mjs 4600`).
  - `cwd` (optional): working directory, resolved relative to the config file.
  - readiness signal (one required): `readyUrl` (any HTTP response means up), `readyPort` (TCP connect succeeds), or `readyLog` (substring appears in stdout/stderr).
  - `timeoutMs` (optional, default 30000): how long to wait for readiness.
- `viewport` (optional, default `{ "width": 1280, "height": 720 }`): browser + video size.
- `stepDelayMs` (optional, default `700`): milliseconds to pause **between** scenario steps so the video is not too fast to follow. Overridden by `--slow <ms>`.
- `slowMo` (optional, default `250`): Playwright `slowMo`, milliseconds added **inside** each browser action (clicks, typing) so individual actions are visibly slower. Overridden by `--slow-mo <ms>`.
- `showCursor` (optional, default `true`): inject a synthetic mouse cursor overlay that glides to each control before clicking and shows a click ripple. Set `false` (or pass `--no-cursor`) to disable.
- `review` (optional): declare incidental console/network noise that should NOT fail the run.
  - `ignoreConsole` (optional, array of case-insensitive regex strings): matched against each console error's text.
  - `ignoreNetwork` (optional, array of case-insensitive regex strings): matched against `"<STATUS> <METHOD> <URL>"` for each failed (`>= 400`) response (e.g. `"404 GET .*/favicon\\.ico"`).
  - Omit the block (or use empty arrays) to keep the strict "any error fails" behavior.
- `scenario` (required, non-empty array): the steps to run in order.

`launch.command` runs **through a shell**, so a shared `demo.config.json` is executable code; treat it as trusted the same way you would a checked-in npm script, and only run configs you trust.

**Scenario actions**

- `goto` — `{ "url": "/path" }`: navigate (relative to `baseUrl`).
- `click` — `{ "selector": "#id" }` or `{ "text": "Save" }` or `{ "role": "button", "name": "Save" }`. When the cursor is on, it glides to the target first.
- `fill` — `{ "selector": "#id", "value": "text" }`: set an input's value.
- `type` — `{ "selector": "#id", "value": "text" }`: type key-by-key.
- `press` — `{ "key": "Enter" }`: press a keyboard key.
- `waitFor` — one of `{ "selector" }`, `{ "text" }`, `{ "url" }`, or `{ "ms": 500 }`.
- `expectText` — `{ "text": "15", "selector": "#display" }` (selector optional; defaults to body). Assertion.
- `expectVisible` — `{ "selector": "#el" }`: assertion that the element is visible.
- `screenshot` — `{ "label": "name" }`: capture an extra labeled screenshot.
- `snapshot` — `{ "label": "name" }`: capture an accessibility snapshot.

`expect*` failures are recorded as failed steps but the run **continues** so the video captures the failure state.

### 2. Record the run

```sh
node scripts/demo-run.mjs --config examples/calculator/demo.config.json
```

Optional flags:

- `--base-url <url>` — override `baseUrl`.
- `--slow <ms>` (alias `--step-delay <ms>`) — pause between steps; overrides `stepDelayMs`.
- `--slow-mo <ms>` (alias `--slowmo <ms>`) — Playwright slowMo; overrides `slowMo`.
- `--no-cursor` / `--cursor` — turn the visible cursor off / on; overrides `showCursor`.
- `--headed` is accepted but ignored (always headless).

Artifacts are written to `<ARTIFACTS_ROOT>/<runId>/`, where the artifacts root defaults to `<cwd>/.demo-recorder/artifacts` and is overridable via the `DEMO_RECORDER_ARTIFACTS_ROOT` env var (set it if you want runs to land somewhere specific; `review.mjs` honors the same variable):

- `video/demo.mp4` — the **deliverable** H.264 video (transcoded from the WebM). This is what you show the user.
- `video/demo.webm` — the **real** recorded video Playwright captured; retained as the source recording (and used if the mp4 transcode was skipped).
- `screenshots/` — one PNG per step (failure screenshots are suffixed `-FAIL`).
- `snapshots/` — accessibility snapshots for `snapshot` steps.
- `action-log.json` — structured log: `meta` (including the `watchability` settings and the `video` transcode result), `summary`, `steps[]`, plus captured console errors and failed network responses (HTTP >= 400) keyed to the step that was running.

`demo-run.mjs` exits non-zero if any step failed or errored.

### 3. Review

```sh
node scripts/review.mjs            # reviews the latest run
node scripts/review.mjs --run <runId | run dir>
```

This writes `review-report.md` into the run directory with an overall **verdict** (PASS only if every scenario step passed and there were no console/network errors that were not explicitly ignored), a per-step table, captured console/network errors keyed to the step they occurred in, the absolute path to the deliverable `video/demo.mp4` (with `video/demo.webm` as the source), the list of key/failure screenshots, and, for each failed step, a "likely cause / where to look" hint.

`review.mjs` exits non-zero on FAIL.

**Then actually look at the evidence:** READ `review-report.md`, open `video/demo.mp4`, and open the failure screenshot(s) for any failing step.

### 4. Fix and repeat

Use the failure analysis to fix the **product code** (the app under test), not the scenario, unless the scenario itself is wrong. Then re-run steps 2 and 3 until the review verdict is **PASS**. When it passes, report the `video/demo.mp4` to the user as the proof the flow works.

## Reporting to the user

Always surface `video/demo.mp4` (the H.264 transcode of the real recording) as the deliverable, since mp4 is broadly playable and embeddable. `video/demo.webm` is the source recording and a fine fallback if the mp4 transcode was skipped (no ffmpeg). Screenshots and `review-report.md` are supporting evidence.

## Installing into a tool

The same `SKILL.md` works in all three tools; only the discovery directory differs. Use the installer:

```sh
node scripts/install-skill.mjs                       # symlink into ./.kiro, ./.claude, ./.opencode
node scripts/install-skill.mjs --copy                # copy instead of symlink
node scripts/install-skill.mjs --global              # into ~/.kiro, ~/.claude, ~/.config/opencode
node scripts/install-skill.mjs --tools kiro,claude   # a subset
node scripts/install-skill.mjs --dry-run             # print planned actions only
```

Discovery locations: Kiro `.kiro/skills/demo-recorder`, Claude Code `.claude/skills/demo-recorder`, opencode `.opencode/skills/demo-recorder` (opencode also reads `.claude/skills` and `.agents/skills`).

**Install dependencies in the canonical dir first.** The engine needs `playwright` (and `ffmpeg-static`) in the canonical dir's `node_modules`. A symlink install shares it and a `--copy` install omits it, so the installed skill only runs after `npm install` has been run once in the canonical `skills/demo-recorder` dir. The installer prints this reminder.
