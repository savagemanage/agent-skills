#!/usr/bin/env node
// demo-run.mjs — main entry for the demo-recorder engine.
//
// Launches the target app (if configured), opens a headless Chromium context
// that records a REAL WebM video, executes the config's scenario step by step
// (capturing per-step screenshots, accessibility snapshots for snapshot{} steps,
// and a structured action log), then flushes the video and cleans up.
//
// To make the recording watchable it (1) inserts a configurable pause between
// steps, (2) runs Playwright with slowMo so each action is visibly slower, and
// (3) injects a synthetic mouse cursor that glides to each control before
// clicking (headless Chromium has no visible OS cursor).
//
// Usage:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
//     node scripts/demo-run.mjs --config <path> [--base-url <url>]
//                               [--slow <ms>] [--slow-mo <ms>] [--no-cursor]
//
// The recording is always a real video file written to
// <runDir>/video/demo.webm (and transcoded to demo.mp4). Recording is
// headless-only; --headed is accepted but ignored (there is no display server).

import { writeFile, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

import { loadConfig } from './lib/config.mjs';
import { buildRunPaths, ensureRunDirs } from './lib/paths.mjs';
import { ActionLog } from './lib/actionlog.mjs';
import { launchApp } from './lib/launch.mjs';
import { transcodeToMp4 } from './lib/transcode.mjs';
import { installCursor, glideToLocator, showClickRipple } from './lib/cursor.mjs';

function parseArgs(argv) {
  const args = { config: null, baseUrl: null, stepDelayMs: null, slowMo: null, showCursor: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config') args.config = argv[++i];
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--slow' || a === '--step-delay') args.stepDelayMs = Number(argv[++i]);
    else if (a === '--slow-mo' || a === '--slowmo') args.slowMo = Number(argv[++i]);
    else if (a === '--no-cursor') args.showCursor = false;
    else if (a === '--cursor') args.showCursor = true;
    else if (a === '--headed') { /* ignored — always headless */ }
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/demo-run.mjs --config <path> [options]',
    '',
    '  --config <path>      Path to a demo.config.json (required).',
    '  --base-url <url>     Override config.baseUrl.',
    '  --slow <ms>          Pause between scenario steps (alias: --step-delay).',
    '                       Overrides config.stepDelayMs (default 700).',
    '  --slow-mo <ms>       Playwright slowMo added inside each browser action.',
    '                       Overrides config.slowMo (default 250).',
    '  --no-cursor          Do not inject the synthetic mouse cursor overlay.',
    '  --cursor             Force the cursor overlay on.',
    '  --headed             Accepted but ignored; recording is always headless.',
  ].join('\n');
}

/** Resolve a URL that may be relative to baseUrl. */
function resolveUrl(baseUrl, maybeUrl) {
  if (!maybeUrl) return baseUrl;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return maybeUrl;
  }
}

/** Build a Playwright locator for a target descriptor (selector | text | role+name). */
function locate(page, step) {
  if (typeof step.selector === 'string') return page.locator(step.selector);
  if (typeof step.role === 'string' && typeof step.name === 'string') return page.getByRole(step.role, { name: step.name });
  if (typeof step.text === 'string') return page.getByText(step.text);
  throw new Error('no locatable target (need selector, text, or role+name)');
}

async function screenshotStep(page, paths, label) {
  const safe = String(label).replace(/[^a-z0-9._-]+/gi, '_');
  const file = path.join(paths.screenshotsDir, `${safe}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return file;
}

async function snapshotStep(page, paths, label) {
  const safe = String(label).replace(/[^a-z0-9._-]+/gi, '_');
  const file = path.join(paths.snapshotsDir, `${safe}.txt`);
  let snap = '';
  try {
    snap = await page.accessibility.snapshot({ interestingOnly: false });
    snap = JSON.stringify(snap, null, 2);
  } catch (err) {
    snap = `snapshot failed: ${err.message}`;
  }
  await writeFile(file, snap, 'utf8').catch(() => {});
  return file;
}

/**
 * Move the visible cursor to a step's target (when the cursor is enabled and the
 * step has a locatable target), so the recording shows the pointer glide to the
 * control before it is acted on. Best-effort; never throws.
 */
async function moveCursorToStep(page, step, showCursor) {
  if (!showCursor) return;
  const hasTarget = typeof step.selector === 'string'
    || typeof step.text === 'string'
    || (typeof step.role === 'string' && typeof step.name === 'string');
  if (!hasTarget) return;
  try {
    const loc = locate(page, step);
    await glideToLocator(page, loc);
  } catch { /* target may not exist; the action itself will report it */ }
}

/** Execute a single scenario step against the page. Throws only on hard errors. */
async function runStep(page, step, baseUrl, showCursor) {
  switch (step.action) {
    case 'goto':
      await page.goto(resolveUrl(baseUrl, step.url), { waitUntil: 'load' });
      return;
    case 'click':
      await moveCursorToStep(page, step, showCursor);
      if (showCursor) await showClickRipple(page);
      await locate(page, step).click({ timeout: step.timeoutMs ?? 5000 });
      return;
    case 'fill':
      await moveCursorToStep(page, step, showCursor);
      await page.locator(step.selector).fill(step.value, { timeout: step.timeoutMs ?? 5000 });
      return;
    case 'type':
      await moveCursorToStep(page, step, showCursor);
      await page.locator(step.selector).pressSequentially(step.value, { timeout: step.timeoutMs ?? 5000 });
      return;
    case 'press':
      await page.keyboard.press(step.key);
      return;
    case 'waitFor':
      if (typeof step.ms === 'number') { await page.waitForTimeout(step.ms); return; }
      if (typeof step.url === 'string') { await page.waitForURL(resolveUrl(baseUrl, step.url), { timeout: step.timeoutMs ?? 5000 }); return; }
      if (typeof step.selector === 'string') { await page.locator(step.selector).waitFor({ timeout: step.timeoutMs ?? 5000 }); return; }
      if (typeof step.text === 'string') { await page.getByText(step.text).first().waitFor({ timeout: step.timeoutMs ?? 5000 }); return; }
      return;
    case 'expectText': {
      const scope = typeof step.selector === 'string' ? page.locator(step.selector) : page.locator('body');
      const content = await scope.first().innerText({ timeout: step.timeoutMs ?? 5000 });
      if (!content.includes(step.text)) {
        const err = new Error(`expected text "${step.text}" not found`);
        err.expectFailure = true;
        throw err;
      }
      return;
    }
    case 'expectVisible': {
      const visible = await page.locator(step.selector).first().isVisible().catch(() => false);
      if (!visible) {
        const err = new Error(`expected selector "${step.selector}" to be visible`);
        err.expectFailure = true;
        throw err;
      }
      return;
    }
    case 'screenshot':
    case 'snapshot':
      // Handled by the caller (needs paths); nothing to do here.
      return;
    default:
      throw new Error(`unsupported action "${step.action}"`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.config) {
    console.log(usage());
    process.exit(args.help ? 0 : 2);
  }

  const config = await loadConfig(args.config);
  const baseUrl = args.baseUrl ?? config.baseUrl;

  // Resolve watchability knobs: CLI flags override config, which has defaults.
  const stepDelayMs = Number.isFinite(args.stepDelayMs) ? args.stepDelayMs : config.stepDelayMs;
  const slowMo = Number.isFinite(args.slowMo) ? args.slowMo : config.slowMo;
  const showCursor = args.showCursor == null ? config.showCursor : args.showCursor;

  const paths = buildRunPaths(config.name);
  await ensureRunDirs(paths);

  const log = new ActionLog({
    runId: paths.runId,
    configName: config.name,
    baseUrl,
    // Carry the review policy (ignorable console/network patterns) so review.mjs
    // can honor it from the action log alone.
    review: config.review,
    // Record the watchability settings that produced this recording.
    watchability: { stepDelayMs, slowMo, showCursor },
  });

  let app = null;
  let browser = null;
  let context = null;
  let pageVideo = null;

  // Pause between steps so the recorded video is easy to follow.
  const pauseBetweenSteps = async (page) => {
    if (stepDelayMs > 0) await page.waitForTimeout(stepDelayMs);
  };

  try {
    // 1) Launch the app if configured.
    if (config.launch) {
      app = await launchApp(config.launch);
    }

    // 2) Open a headless browser that records a real video. slowMo makes each
    //    browser action visibly slower in the recording.
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], slowMo });
    context = await browser.newContext({
      viewport: config.viewport,
      recordVideo: { dir: paths.videoDir, size: config.viewport },
    });
    const page = await context.newPage();
    // Hold the page's own video handle so we can promote the correct recording
    // deterministically, even when the scenario opens extra pages/popups (each
    // produces its own .webm). Resolved after context.close() flushes it.
    pageVideo = page.video();

    // Inject the synthetic cursor overlay (survives navigations via init script).
    if (showCursor) {
      await installCursor(context, page);
    }

    // Wire page-level diagnostics into the action log.
    page.on('console', (msg) => {
      if (msg.type() === 'error') log.addConsoleError(msg.text());
    });
    page.on('pageerror', (err) => log.addConsoleError(err.message));
    page.on('response', (res) => {
      const status = res.status();
      if (status >= 400) log.addNetworkError({ url: res.url(), status, method: res.request().method() });
    });

    // Always start by navigating to baseUrl (unless the first step is a goto).
    if (config.scenario[0]?.action !== 'goto') {
      const rec = log.startStep('goto', { url: baseUrl });
      try {
        await page.goto(baseUrl, { waitUntil: 'load' });
        if (showCursor) await installCursor(context, page);
        const shot = await screenshotStep(page, paths, `00-open`);
        log.finishStep(rec, { status: 'pass', screenshot: shot });
      } catch (err) {
        const shot = await screenshotStep(page, paths, `00-open-FAIL`);
        log.finishStep(rec, { status: 'error', detail: err.message, screenshot: shot });
        throw err;
      }
      await pauseBetweenSteps(page);
    }

    // 3) Execute scenario steps sequentially.
    for (let i = 0; i < config.scenario.length; i++) {
      const step = config.scenario[i];
      const { action, ...args } = step;
      const rec = log.startStep(action, args);
      const label = `${String(i + 1).padStart(2, '0')}-${action}${step.label ? '-' + step.label : ''}`;
      try {
        if (action === 'snapshot') {
          const snap = await snapshotStep(page, paths, step.label ?? label);
          const shot = await screenshotStep(page, paths, label);
          log.finishStep(rec, { status: 'pass', screenshot: shot, snapshot: snap });
        } else if (action === 'screenshot') {
          const shot = await screenshotStep(page, paths, step.label ?? label);
          log.finishStep(rec, { status: 'pass', screenshot: shot });
        } else {
          await runStep(page, step, baseUrl, showCursor);
          // Re-ensure the cursor after a goto (new document).
          if (showCursor && action === 'goto') await installCursor(context, page);
          const shot = await screenshotStep(page, paths, label);
          log.finishStep(rec, { status: 'pass', screenshot: shot });
        }
      } catch (err) {
        const shot = await screenshotStep(page, paths, `${label}-FAIL`);
        if (err.expectFailure) {
          // Assertion failure: mark failed but CONTINUE so the video shows it.
          log.finishStep(rec, { status: 'fail', detail: err.message, screenshot: shot });
        } else {
          // Hard error on this step: record and continue to keep the run resilient.
          log.finishStep(rec, { status: 'error', detail: err.message, screenshot: shot });
        }
      }
      await pauseBetweenSteps(page);
    }
  } finally {
    // ALWAYS flush the video (close context) and clean up processes.
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (app) {
      await app.stop().catch(() => {});
    }
  }

  // Promote the driven page's OWN recording to demo.webm. Using the page's
  // video handle (rather than "first .webm that isn't demo.webm") is
  // deterministic even when the scenario opened extra pages/popups, each of
  // which produces its own .webm in the same dir.
  let videoPath = paths.videoFile;
  try {
    let produced = null;
    if (pageVideo) {
      // Resolves once context.close() has flushed the recording to disk.
      produced = await pageVideo.path().catch(() => null);
    }
    if (produced && path.resolve(produced) !== path.resolve(paths.videoFile)) {
      await rename(produced, paths.videoFile);
    } else if (!produced) {
      // Fallback: no page video handle (should not happen with recordVideo on).
      // Pick any .webm that isn't already demo.webm.
      const files = (await readdir(paths.videoDir)).filter((f) => f.endsWith('.webm'));
      const other = files.find((f) => f !== 'demo.webm');
      if (other) {
        await rename(path.join(paths.videoDir, other), paths.videoFile);
      } else if (!files.includes('demo.webm') && files.length > 0) {
        videoPath = path.join(paths.videoDir, files[0]);
      }
    }
  } catch { /* leave videoPath as default */ }

  // Transcode the real WebM recording into an H.264 mp4 so the primary
  // deliverable video is a broadly-playable .mp4. The WebM is retained as the
  // source recording. This step is best-effort: if ffmpeg is missing or the
  // transcode fails, we keep the WebM and record the reason in the action log
  // (review.mjs surfaces it) rather than failing the whole run.
  let mp4Path = null;
  let video = { webm: videoPath, mp4: null, mp4Skipped: false, mp4Reason: null, mp4Encoder: null, ffmpegSource: null };
  try {
    const result = await transcodeToMp4(videoPath, paths.mp4File);
    if (result.ok) {
      mp4Path = result.mp4Path;
      video.mp4 = result.mp4Path;
      video.mp4Encoder = result.encoder ?? null;
      video.ffmpegSource = result.ffmpeg?.source ?? null;
    } else {
      video.mp4Skipped = !!result.skipped;
      video.mp4Reason = result.reason ?? 'unknown';
      video.ffmpegSource = result.ffmpeg?.source ?? null;
    }
  } catch (err) {
    video.mp4Skipped = false;
    video.mp4Reason = `transcode threw: ${err.message}`;
  }
  // Carry the video info into the action log meta so review.mjs can report it.
  log.meta.video = video;

  // Write the action log.
  await writeFile(paths.actionLogFile, log.toString(), 'utf8');

  const summary = log.summary();
  console.log('');
  console.log(`demo-recorder run complete: ${paths.runId}`);
  console.log(`  watchability: stepDelay=${stepDelayMs}ms slowMo=${slowMo}ms cursor=${showCursor ? 'on' : 'off'}`);
  if (mp4Path) {
    console.log(`  video (mp4): ${mp4Path}  <- deliverable`);
    console.log(`  video (src): ${videoPath}  (WebM source recording)`);
  } else {
    console.log(`  video:       ${videoPath}  (WebM; mp4 ${video.mp4Skipped ? 'skipped' : 'failed'}: ${video.mp4Reason})`);
  }
  console.log(`  action log:  ${paths.actionLogFile}`);
  console.log(`  screenshots: ${paths.screenshotsDir}`);
  console.log(`  steps:       ${summary.total} total | ${summary.pass} pass | ${summary.fail} fail | ${summary.error} error`);
  console.log(`  diagnostics: ${summary.consoleErrors} console error(s), ${summary.networkErrors} failed network response(s)`);
  console.log('');

  process.exit(summary.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`demo-recorder fatal error: ${err.stack || err.message}`);
  process.exit(1);
});
