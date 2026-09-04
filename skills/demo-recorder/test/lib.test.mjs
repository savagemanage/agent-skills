// lib.test.mjs — unit tests for the pure demo-recorder lib helpers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { validateConfig, validateStep, validateReview, ConfigError, SCENARIO_ACTIONS } from '../scripts/lib/config.mjs';
import { slugify, buildRunId, buildRunPaths, buildRunPathsFromDir, resolveArtifactsRoot, ARTIFACTS_ROOT, DEFAULT_ARTIFACTS_ROOT } from '../scripts/lib/paths.mjs';
import { ActionLog } from '../scripts/lib/actionlog.mjs';
import { computeVerdict, renderReport, hintForStep, partitionDiagnostics } from '../scripts/lib/review.mjs';

// ---------------------------------------------------------------------------
// config validation
// ---------------------------------------------------------------------------

test('validateConfig accepts a valid config and applies defaults', () => {
  const cfg = validateConfig({
    name: 'todo-app',
    baseUrl: 'http://127.0.0.1:4599',
    scenario: [
      { action: 'goto', url: '/' },
      { action: 'click', selector: '#add-btn' },
    ],
  });
  assert.equal(cfg.name, 'todo-app');
  assert.equal(cfg.baseUrl, 'http://127.0.0.1:4599');
  assert.deepEqual(cfg.viewport, { width: 1280, height: 720 });
  assert.equal(cfg.launch, undefined);
  assert.equal(cfg.scenario.length, 2);
});

test('validateConfig resolves and defaults a launch block', () => {
  const cfg = validateConfig(
    {
      name: 'app',
      baseUrl: 'http://127.0.0.1:3000',
      launch: { command: 'node server.mjs', readyPort: 3000 },
      scenario: [{ action: 'goto', url: '/' }],
    },
    '/tmp/some/dir/demo.config.json',
  );
  assert.equal(cfg.launch.command, 'node server.mjs');
  assert.equal(cfg.launch.timeoutMs, 30000);
  assert.equal(cfg.launch.cwd, path.resolve('/tmp/some/dir'));
});

test('validateConfig rejects missing required fields', () => {
  assert.throws(() => validateConfig({ baseUrl: 'x', scenario: [{ action: 'goto', url: '/' }] }), ConfigError);
  assert.throws(() => validateConfig({ name: 'x', scenario: [{ action: 'goto', url: '/' }] }), ConfigError);
  assert.throws(() => validateConfig({ name: 'x', baseUrl: 'y', scenario: [] }), ConfigError);
  assert.throws(() => validateConfig(null), ConfigError);
});

test('validateStep rejects unknown actions and bad args', () => {
  assert.throws(() => validateStep({ action: 'teleport' }, 0), ConfigError);
  assert.throws(() => validateStep({ action: 'goto' }, 0), ConfigError); // missing url
  assert.throws(() => validateStep({ action: 'fill', selector: '#a' }, 0), ConfigError); // missing value
  assert.throws(() => validateStep({ action: 'click' }, 0), ConfigError); // no target
  // click accepts role+name
  assert.doesNotThrow(() => validateStep({ action: 'click', role: 'button', name: 'Save' }, 0));
  assert.ok(SCENARIO_ACTIONS.has('expectText'));
});

test('validateConfig rejects a launch block with no readiness signal', () => {
  assert.throws(
    () => validateConfig({ name: 'x', baseUrl: 'y', launch: { command: 'run' }, scenario: [{ action: 'goto', url: '/' }] }),
    ConfigError,
  );
});

test('validateReview normalizes ignore patterns and validates regex', () => {
  assert.equal(validateReview(undefined), undefined);
  assert.equal(validateReview({}), undefined); // empty arrays collapse to undefined
  const r = validateReview({ ignoreConsole: ['favicon'], ignoreNetwork: ['404 GET .*/favicon\\.ico'] });
  assert.deepEqual(r.ignoreConsole, ['favicon']);
  assert.deepEqual(r.ignoreNetwork, ['404 GET .*/favicon\\.ico']);
  // bad shape / bad regex are rejected
  assert.throws(() => validateReview({ ignoreConsole: 'nope' }), ConfigError);
  assert.throws(() => validateReview({ ignoreConsole: [''] }), ConfigError);
  assert.throws(() => validateReview({ ignoreNetwork: ['('] }), ConfigError);
});

test('validateConfig threads a normalized review block through', () => {
  const cfg = validateConfig({
    name: 'app',
    baseUrl: 'http://x',
    review: { ignoreNetwork: ['^404 '] },
    scenario: [{ action: 'goto', url: '/' }],
  });
  assert.deepEqual(cfg.review, { ignoreConsole: [], ignoreNetwork: ['^404 '] });
});

// ---------------------------------------------------------------------------
// paths builder
// ---------------------------------------------------------------------------

test('slugify produces a filesystem-safe token', () => {
  assert.equal(slugify('Todo App!'), 'todo-app');
  assert.equal(slugify('  --Weird__Name-- '), 'weird-name');
  assert.equal(slugify(''), 'demo');
});

test('buildRunId is timestamped and slugged', () => {
  const id = buildRunId('My App', new Date(Date.UTC(2024, 0, 2, 3, 4, 5)));
  assert.equal(id, '20240102-030405-my-app');
});

test('buildRunPaths returns absolute paths under the artifacts root', () => {
  const p = buildRunPaths('todo-app', { runId: '20240102-030405-todo-app' });
  assert.ok(path.isAbsolute(p.runDir));
  assert.ok(path.isAbsolute(p.videoFile));
  assert.ok(path.isAbsolute(p.actionLogFile));
  assert.ok(p.runDir.startsWith(ARTIFACTS_ROOT));
  assert.equal(p.videoFile, path.join(ARTIFACTS_ROOT, '20240102-030405-todo-app', 'video', 'demo.webm'));
  assert.equal(p.mp4File, path.join(ARTIFACTS_ROOT, '20240102-030405-todo-app', 'video', 'demo.mp4'));
  assert.equal(p.actionLogFile, path.join(p.runDir, 'action-log.json'));
  assert.equal(p.reviewReportFile, path.join(p.runDir, 'review-report.md'));
});

test('buildRunPathsFromDir derives every path from the given run dir (not the artifacts root)', () => {
  const external = '/tmp/somewhere/else/20240102-030405-todo-app';
  const p = buildRunPathsFromDir(external);
  assert.equal(p.runId, '20240102-030405-todo-app');
  assert.equal(p.runDir, external);
  assert.equal(p.videoFile, path.join(external, 'video', 'demo.webm'));
  assert.equal(p.mp4File, path.join(external, 'video', 'demo.mp4'));
  assert.equal(p.actionLogFile, path.join(external, 'action-log.json'));
  assert.equal(p.reviewReportFile, path.join(external, 'review-report.md'));
  // Crucially, nothing is re-rooted under the artifacts root.
  assert.ok(!p.reviewReportFile.startsWith(ARTIFACTS_ROOT));
  assert.ok(!p.videoFile.startsWith(ARTIFACTS_ROOT));
});

test('resolveArtifactsRoot honors the env override and defaults otherwise', () => {
  assert.equal(resolveArtifactsRoot({}), DEFAULT_ARTIFACTS_ROOT);
  assert.equal(resolveArtifactsRoot({ DEMO_RECORDER_ARTIFACTS_ROOT: '   ' }), DEFAULT_ARTIFACTS_ROOT);
  assert.equal(resolveArtifactsRoot({ DEMO_RECORDER_ARTIFACTS_ROOT: '/custom/root' }), '/custom/root');
  // relative overrides are resolved against cwd
  assert.equal(resolveArtifactsRoot({ DEMO_RECORDER_ARTIFACTS_ROOT: 'rel/root' }), path.resolve('rel/root'));
  // default constant matches the default resolution (back-compat for the smoke test).
  assert.equal(ARTIFACTS_ROOT, DEFAULT_ARTIFACTS_ROOT);
});

test('buildRunPaths honors an artifactsRoot override', () => {
  const p = buildRunPaths('todo-app', { runId: 'r1', artifactsRoot: '/custom/root' });
  assert.equal(p.runDir, path.join('/custom/root', 'r1'));
  assert.equal(p.videoFile, path.join('/custom/root', 'r1', 'video', 'demo.webm'));
});

// ---------------------------------------------------------------------------
// action log serialization
// ---------------------------------------------------------------------------

test('ActionLog records steps and serializes the expected shape', () => {
  const log = new ActionLog({ runId: 'r1', configName: 'todo-app', baseUrl: 'http://x' });
  const s0 = log.startStep('goto', { url: '/' });
  log.finishStep(s0, { status: 'pass', screenshot: '/abs/01.png' });
  const s1 = log.startStep('expectText', { text: 'nope' });
  log.finishStep(s1, { status: 'fail', detail: 'expected text "nope" not found', screenshot: '/abs/02-FAIL.png' });
  log.addConsoleError('boom');
  log.addNetworkError({ url: 'http://x/api', status: 500, method: 'GET' });

  const json = log.toJSON();
  assert.equal(json.meta.runId, 'r1');
  assert.equal(json.meta.configName, 'todo-app');
  assert.ok(json.meta.finishedAt);
  assert.equal(json.steps.length, 2);
  // internal timing field is stripped
  assert.ok(!('_start' in json.steps[0]));
  assert.deepEqual(json.steps[0].args, { url: '/' });
  assert.equal(json.steps[0].status, 'pass');
  assert.equal(json.steps[1].status, 'fail');
  assert.equal(json.consoleErrors.length, 1);
  assert.equal(json.networkErrors[0].status, 500);
  // console/network errors keyed to the step that was executing (index 1)
  assert.equal(json.consoleErrors[0].stepIndex, 1);
  assert.equal(json.networkErrors[0].stepIndex, 1);

  const sum = json.summary;
  assert.equal(sum.total, 2);
  assert.equal(sum.pass, 1);
  assert.equal(sum.fail, 1);
  assert.equal(sum.consoleErrors, 1);
  assert.equal(sum.networkErrors, 1);
  assert.equal(sum.ok, false);

  // toString is valid JSON
  assert.doesNotThrow(() => JSON.parse(log.toString()));
});

test('ActionLog summary is ok for a clean run', () => {
  const log = new ActionLog({ runId: 'r2' });
  const s = log.startStep('goto', { url: '/' });
  log.finishStep(s, { status: 'pass' });
  assert.equal(log.summary().ok, true);
});

// ---------------------------------------------------------------------------
// review verdict + report
// ---------------------------------------------------------------------------

function makeLog(overrides = {}) {
  return {
    meta: { runId: 'r', configName: 'todo-app', baseUrl: 'http://x' },
    summary: { total: 1, pass: 1, fail: 0, error: 0, consoleErrors: 0, networkErrors: 0, ok: true },
    steps: [{ index: 0, action: 'goto', args: { url: '/' }, status: 'pass', durationMs: 10, detail: null, screenshot: '/a/01.png' }],
    consoleErrors: [],
    networkErrors: [],
    ...overrides,
  };
}

test('computeVerdict returns PASS for a clean run', () => {
  assert.equal(computeVerdict(makeLog()), 'PASS');
});

test('computeVerdict returns FAIL when a step failed', () => {
  const log = makeLog({ steps: [{ index: 0, action: 'expectText', args: { text: 'x' }, status: 'fail', detail: 'nope' }] });
  assert.equal(computeVerdict(log), 'FAIL');
});

test('computeVerdict returns FAIL when a step errored', () => {
  const log = makeLog({ steps: [{ index: 0, action: 'click', args: { selector: '#x' }, status: 'error', detail: 'timeout' }] });
  assert.equal(computeVerdict(log), 'FAIL');
});

test('computeVerdict returns FAIL when console or network errors were captured', () => {
  assert.equal(computeVerdict(makeLog({ consoleErrors: [{ stepIndex: 0, text: 'boom' }] })), 'FAIL');
  assert.equal(computeVerdict(makeLog({ networkErrors: [{ stepIndex: 0, url: 'http://x', status: 500 }] })), 'FAIL');
});

test('computeVerdict ignores console/network noise matching the config ignore patterns', () => {
  // A favicon 404 and a third-party console warning are declared ignorable, so a
  // clean scenario still PASSES.
  const log = makeLog({
    meta: { runId: 'r', configName: 'todo-app', review: { ignoreConsole: ['third-party'], ignoreNetwork: ['404 GET .*/favicon\\.ico'] } },
    consoleErrors: [{ stepIndex: 0, text: 'third-party analytics failed to load' }],
    networkErrors: [{ stepIndex: 0, url: 'http://x/favicon.ico', status: 404, method: 'GET' }],
  });
  assert.equal(computeVerdict(log), 'PASS');
});

test('computeVerdict still FAILs on non-ignored diagnostics even with ignore patterns present', () => {
  const log = makeLog({
    meta: { runId: 'r', review: { ignoreNetwork: ['404 GET .*/favicon\\.ico'] } },
    networkErrors: [
      { stepIndex: 0, url: 'http://x/favicon.ico', status: 404, method: 'GET' }, // ignored
      { stepIndex: 0, url: 'http://x/api/data', status: 500, method: 'GET' },   // counted
    ],
  });
  assert.equal(computeVerdict(log), 'FAIL');
});

test('partitionDiagnostics splits counted vs ignored diagnostics', () => {
  const log = makeLog({
    meta: { runId: 'r', review: { ignoreConsole: ['warn'], ignoreNetwork: ['^404 '] } },
    consoleErrors: [{ stepIndex: 0, text: 'a warn line' }, { stepIndex: 0, text: 'real error' }],
    networkErrors: [
      { stepIndex: 0, url: 'http://x/favicon.ico', status: 404, method: 'GET' },
      { stepIndex: 0, url: 'http://x/api', status: 500, method: 'GET' },
    ],
  });
  const { console, network } = partitionDiagnostics(log);
  assert.equal(console.ignored.length, 1);
  assert.equal(console.counted.length, 1);
  assert.equal(console.counted[0].text, 'real error');
  assert.equal(network.ignored.length, 1);
  assert.equal(network.counted.length, 1);
  assert.equal(network.counted[0].status, 500);
});

test('renderReport reports counted vs ignored diagnostics and PASSes with only ignored noise', () => {
  const log = makeLog({
    meta: { runId: 'r', configName: 'todo-app', review: { ignoreNetwork: ['404 GET .*/favicon\\.ico'] } },
    networkErrors: [{ stepIndex: 0, url: 'http://x/favicon.ico', status: 404, method: 'GET' }],
  });
  const md = renderReport(log, { videoFile: '/abs/run/video/demo.webm', runId: 'r' });
  assert.match(md, /\*\*Verdict: PASS\*\*/);
  assert.match(md, /ignored/);
  assert.match(md, /ignored by config/);
});

test('renderReport emits verdict, per-step table, video path and failure hints', () => {
  const log = makeLog({
    summary: { total: 2, pass: 1, fail: 1, error: 0, consoleErrors: 0, networkErrors: 0, ok: false },
    steps: [
      { index: 0, action: 'goto', args: { url: '/' }, status: 'pass', durationMs: 5, detail: null, screenshot: '/a/01.png' },
      { index: 1, action: 'expectText', args: { selector: '#count', text: '1 remaining' }, status: 'fail', durationMs: 20, detail: 'expected text "1 remaining" not found', screenshot: '/a/02-FAIL.png' },
    ],
  });
  const md = renderReport(log, { videoFile: '/abs/run/video/demo.webm', runId: 'r' });
  assert.match(md, /\*\*Verdict: FAIL\*\*/);
  assert.match(md, /\/abs\/run\/video\/demo\.webm/);
  assert.match(md, /\| # \| Action \| Status \|/);
  assert.match(md, /Failure analysis/);
  assert.match(md, /1 remaining/);
  assert.match(md, /02-FAIL\.png/);
});

test('renderReport shows a clean report for PASS', () => {
  const md = renderReport(makeLog(), { videoFile: '/abs/run/video/demo.webm' });
  assert.match(md, /\*\*Verdict: PASS\*\*/);
  assert.match(md, /No failed steps/);
});

test('renderReport surfaces the mp4 as the primary deliverable when produced', () => {
  const log = makeLog({
    meta: {
      runId: 'r', configName: 'calculator',
      video: {
        webm: '/abs/run/video/demo.webm',
        mp4: '/abs/run/video/demo.mp4',
        mp4Encoder: 'libx264',
        ffmpegSource: 'ffmpeg-static',
        mp4Skipped: false,
        mp4Reason: null,
      },
    },
  });
  const md = renderReport(log, { videoFile: '/abs/run/video/demo.webm', mp4File: '/abs/run/video/demo.mp4', runId: 'r' });
  assert.match(md, /## Demo video \(mp4 — show this to the user\)/);
  assert.match(md, /mp4 \(deliverable\).*demo\.mp4/s);
  assert.match(md, /source recording \(WebM\).*demo\.webm/s);
  assert.match(md, /libx264/);
});

test('renderReport falls back to the WebM deliverable and explains why mp4 is absent', () => {
  const log = makeLog({
    meta: {
      runId: 'r', configName: 'calculator',
      video: {
        webm: '/abs/run/video/demo.webm',
        mp4: null,
        mp4Skipped: true,
        mp4Reason: 'ffmpeg not found (set DEMO_RECORDER_FFMPEG, install ffmpeg-static, or put ffmpeg on PATH)',
      },
    },
  });
  const md = renderReport(log, { videoFile: '/abs/run/video/demo.webm', runId: 'r' });
  assert.match(md, /## Demo video \(real WebM — show this to the user\)/);
  assert.match(md, /WebM \(deliverable\)/);
  assert.match(md, /mp4 was skipped: ffmpeg not found/);
});

test('hintForStep tailors guidance per action', () => {
  const clickHint = hintForStep({ index: 1, action: 'click', args: { selector: '#add-btn' }, detail: 'timeout' }, {});
  assert.match(clickHint, /#add-btn/);
  const textHint = hintForStep({ index: 2, action: 'expectText', args: { selector: '#count', text: '1 remaining' }, detail: 'not found' }, {});
  assert.match(textHint, /1 remaining/);
});
