// smoke.test.mjs — end-to-end integration test for the demo-recorder engine.
//
// Runs demo-run.mjs against the bundled calculator example as a subprocess, then
// asserts that a REAL WebM video was produced (verified by the EBML/WebM magic
// bytes, not just the extension), that the action log parses with the expected
// number of step records, and that review.mjs yields a PASS verdict.
//
// This test genuinely exercises the recording pipeline: if video recording were
// removed or broken, the magic-byte check would fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(__filename), '..');
const CONFIG = path.join(SKILL_DIR, 'examples', 'calculator', 'demo.config.json');

// Pin the artifacts root for this test so the subprocess and this process agree
// regardless of cwd (the default artifacts root is cwd-relative). Passed to the
// child via DEMO_RECORDER_ARTIFACTS_ROOT.
const ARTIFACTS_ROOT = path.join(SKILL_DIR, '.demo-recorder', 'artifacts');

// WebM/Matroska files begin with the EBML header magic bytes.
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/**
 * Return true if the file looks like an ISO Base Media (mp4) file: bytes 4..8
 * are the 'ftyp' box type. (mp4 has no fixed magic at offset 0; the size-
 * prefixed 'ftyp' box is the reliable signature.)
 */
async function isMp4(file) {
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    return buf.slice(4, 8).toString('latin1') === 'ftyp';
  } finally {
    await fh.close();
  }
}

function childEnv() {
  const env = { ...process.env };
  // The engine needs to find the pre-installed Chromium; honor an env override,
  // falling back to the documented location.
  env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/playwright';
  env.DEMO_RECORDER_ARTIFACTS_ROOT = ARTIFACTS_ROOT;
  return env;
}

async function startsWithMagic(file, magic) {
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(magic.length);
    await fh.read(buf, 0, magic.length, 0);
    return buf.equals(magic);
  } finally {
    await fh.close();
  }
}

test('demo-run produces a real WebM, a parseable action log, and a PASS review', { timeout: 120_000 }, async () => {
  // 1) Run the engine against the bundled example.
  const run = spawnSync('node', [path.join('scripts', 'demo-run.mjs'), '--config', CONFIG], {
    cwd: SKILL_DIR,
    env: childEnv(),
    encoding: 'utf8',
    timeout: 100_000,
  });

  assert.equal(run.status, 0, `demo-run.mjs exited non-zero.\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);

  // Parse the runId from the stdout summary ("demo-recorder run complete: <runId>").
  const m = run.stdout.match(/demo-recorder run complete: (\S+)/);
  assert.ok(m, `could not find runId in stdout:\n${run.stdout}`);
  const runId = m[1];
  const runDir = path.join(ARTIFACTS_ROOT, runId);

  // 2) A real WebM video exists (magic-byte verified). This is the real screen
  // recording produced natively by Playwright; do NOT weaken this assertion.
  const videoFile = path.join(runDir, 'video', 'demo.webm');
  const isWebm = await startsWithMagic(videoFile, WEBM_MAGIC);
  assert.ok(isWebm, `expected a real WebM (EBML magic bytes) at ${videoFile}`);

  // 2b) The WebM is transcoded to an mp4 deliverable. ffmpeg-static ships an
  // H.264-capable ffmpeg, so a normal run must produce a valid mp4 (verified by
  // the ISO 'ftyp' box, not just the extension). The action log records the
  // transcode result under meta.video.
  const mp4File = path.join(runDir, 'video', 'demo.mp4');
  const mp4Ok = await isMp4(mp4File);
  assert.ok(mp4Ok, `expected a real mp4 (ISO ftyp box) at ${mp4File}`);

  // 3) action-log.json parses and has the expected number of step records.
  const config = JSON.parse(await readFile(CONFIG, 'utf8'));
  const expectedSteps = config.scenario.length; // first step is a goto, so no synthetic step is added
  const log = JSON.parse(await readFile(path.join(runDir, 'action-log.json'), 'utf8'));
  assert.equal(log.steps.length, expectedSteps, `expected ${expectedSteps} step records, got ${log.steps.length}`);
  assert.equal(log.summary.total, expectedSteps);
  assert.equal(log.summary.ok, true, `expected the happy-path run to be ok; summary=${JSON.stringify(log.summary)}`);

  // The action log records the transcode result: mp4 produced, WebM retained,
  // and an ffmpeg source was detected.
  assert.ok(log.meta.video, 'action log should carry meta.video from the transcode step');
  assert.equal(log.meta.video.mp4, mp4File, 'meta.video.mp4 should point at the produced mp4');
  assert.match(log.meta.video.webm, /demo\.webm$/, 'meta.video.webm should point at the WebM source');
  assert.ok(log.meta.video.ffmpegSource, 'an ffmpeg source should have been detected for the transcode');

  // 4) review.mjs on that run yields review-report.md with a PASS verdict.
  const review = spawnSync('node', [path.join('scripts', 'review.mjs'), '--run', runId], {
    cwd: SKILL_DIR,
    env: childEnv(),
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(review.status, 0, `review.mjs exited non-zero for a happy-path run.\nstdout:\n${review.stdout}\nstderr:\n${review.stderr}`);

  const report = await readFile(path.join(runDir, 'review-report.md'), 'utf8');
  assert.match(report, /\*\*Verdict: PASS\*\*/, 'review report should show a PASS verdict for the happy path');
  assert.match(report, /demo\.webm/, 'review report should reference the WebM source recording');
  assert.match(report, /demo\.mp4/, 'review report should reference the mp4 deliverable');
  assert.match(report, /mp4 \(deliverable\)/, 'review report should surface the mp4 as the primary deliverable');
});
