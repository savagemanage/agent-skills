// review-cli.test.mjs — tests for the review.mjs CLI path resolution.
//
// Focuses on the external-run-dir case: reviewing a run whose directory lives
// OUTSIDE the artifacts root must write review-report.md into that same dir and
// report the video path inside it (not re-rooted under ARTIFACTS_ROOT).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(__filename), '..');
const REVIEW = path.join('scripts', 'review.mjs');

function makeLog(overrides = {}) {
  return {
    meta: { runId: 'r', configName: 'todo-app', baseUrl: 'http://x', ...overrides.meta },
    summary: { total: 1, pass: 1, fail: 0, error: 0, consoleErrors: 0, networkErrors: 0, ok: true },
    steps: [{ index: 0, action: 'goto', args: { url: '/' }, status: 'pass', durationMs: 5, detail: null, screenshot: null }],
    consoleErrors: [],
    networkErrors: [],
    ...overrides,
  };
}

test('review.mjs --run <external dir> writes the report inside that dir, not under the artifacts root', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'demo-recorder-run-'));
  const runDir = path.join(tmp, '20240102-030405-external-app');
  try {
    await mkdir(path.join(runDir, 'video'), { recursive: true });
    await writeFile(path.join(runDir, 'action-log.json'), JSON.stringify(makeLog()), 'utf8');

    const res = spawnSync('node', [REVIEW, '--run', runDir], {
      cwd: SKILL_DIR,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(res.status, 0, `review should PASS.\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`);

    // The report must live inside the external run dir.
    const reportPath = path.join(runDir, 'review-report.md');
    assert.ok((await stat(reportPath)).isFile(), 'review-report.md should be written into the external run dir');
    const report = await readFile(reportPath, 'utf8');
    assert.match(report, /\*\*Verdict: PASS\*\*/);
    // The reported video path must point inside the external run dir.
    assert.match(report, new RegExp(path.join(runDir, 'video', 'demo.webm').replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
    // stdout should reference the in-dir paths too.
    assert.match(res.stdout, new RegExp(reportPath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('review.mjs --run <external dir> honors config ignore patterns carried in the log', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'demo-recorder-run-'));
  const runDir = path.join(tmp, '20240102-030405-noise-app');
  try {
    await mkdir(runDir, { recursive: true });
    const log = makeLog({
      meta: { runId: 'noise', review: { ignoreNetwork: ['404 GET .*/favicon\\.ico'] } },
      networkErrors: [{ stepIndex: 0, url: 'http://x/favicon.ico', status: 404, method: 'GET' }],
    });
    await writeFile(path.join(runDir, 'action-log.json'), JSON.stringify(log), 'utf8');

    const res = spawnSync('node', [REVIEW, '--run', runDir], {
      cwd: SKILL_DIR,
      encoding: 'utf8',
      timeout: 30_000,
    });
    // A lone ignorable favicon 404 must not flip the verdict to FAIL (exit 0).
    assert.equal(res.status, 0, `ignored noise should still PASS.\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`);
    assert.match(res.stdout, /verdict:\s+PASS/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
