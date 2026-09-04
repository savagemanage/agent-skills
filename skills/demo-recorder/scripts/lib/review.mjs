// review.mjs — pure helpers for turning an action-log.json into a review report.
//
// Kept side-effect free (no filesystem, no process) so the verdict logic and
// markdown rendering can be unit-tested in isolation. The CLI wrapper
// (scripts/review.mjs) reads the log from disk, calls these helpers, and writes
// review-report.md.

/**
 * Read the ignore patterns declared by the config (carried in log.meta.review).
 * Returns { ignoreConsole: string[], ignoreNetwork: string[] }.
 */
function reviewPolicy(log) {
  const review = log?.meta?.review || {};
  return {
    ignoreConsole: Array.isArray(review.ignoreConsole) ? review.ignoreConsole : [],
    ignoreNetwork: Array.isArray(review.ignoreNetwork) ? review.ignoreNetwork : [],
  };
}

function compilePatterns(patterns) {
  const compiled = [];
  for (const p of patterns) {
    try { compiled.push(new RegExp(p, 'i')); } catch { /* skip invalid at read time */ }
  }
  return compiled;
}

/** The string a network-ignore pattern is matched against. */
function networkMatchTarget(e) {
  return `${e.status ?? ''} ${e.method || 'GET'} ${e.url ?? ''}`.trim();
}

/**
 * Split captured console/network diagnostics into { counted, ignored } based on
 * the config's ignore patterns. Ambient diagnostics that match a declared
 * pattern (e.g. a favicon 404) are moved to `ignored` and do not affect the
 * verdict; everything else stays `counted`.
 */
export function partitionDiagnostics(log) {
  const { ignoreConsole, ignoreNetwork } = reviewPolicy(log);
  const consoleRe = compilePatterns(ignoreConsole);
  const networkRe = compilePatterns(ignoreNetwork);
  const consoleErrors = Array.isArray(log?.consoleErrors) ? log.consoleErrors : [];
  const networkErrors = Array.isArray(log?.networkErrors) ? log.networkErrors : [];

  const console = { counted: [], ignored: [] };
  for (const e of consoleErrors) {
    (consoleRe.some((re) => re.test(String(e.text ?? ''))) ? console.ignored : console.counted).push(e);
  }
  const network = { counted: [], ignored: [] };
  for (const e of networkErrors) {
    (networkRe.some((re) => re.test(networkMatchTarget(e))) ? network.ignored : network.counted).push(e);
  }
  return { console, network };
}

/**
 * Compute the overall verdict for a run given a parsed action-log object.
 * Returns 'PASS' only when every scenario step passed AND no NON-IGNORED
 * console/network diagnostics were captured; otherwise 'FAIL'. Scenario-step
 * failures always fail. Ambient diagnostics matching the config's
 * review.ignoreConsole / review.ignoreNetwork patterns are treated as noise.
 */
export function computeVerdict(log) {
  const steps = Array.isArray(log?.steps) ? log.steps : [];
  const hasBadStep = steps.some((s) => s.status === 'fail' || s.status === 'error');
  const { console, network } = partitionDiagnostics(log);
  if (hasBadStep || console.counted.length > 0 || network.counted.length > 0) return 'FAIL';
  return 'PASS';
}

/**
 * Produce a short "likely cause / where to look" hint for a failed/errored
 * step, derived from the action, its args, the failure detail, and any
 * console/network errors captured while that step was executing.
 */
export function hintForStep(step, log = {}) {
  const detail = step.detail || '';
  const args = step.args || {};
  const target = args.selector || (args.role && args.name ? `role=${args.role}[name=${args.name}]` : args.text) || args.url || '';
  const consoleErrors = (log.consoleErrors || []).filter((e) => e.stepIndex === step.index);
  const networkErrors = (log.networkErrors || []).filter((e) => e.stepIndex === step.index);

  const parts = [];

  switch (step.action) {
    case 'goto':
      parts.push(`Navigation to "${target}" failed. Check the app is serving that route and baseUrl/launch config is correct.`);
      break;
    case 'click':
      parts.push(`Could not click ${target ? `"${target}"` : 'the target'}. The element/selector may not exist, be hidden, or not yet rendered — inspect the component/markup that should render it and any conditional rendering.`);
      break;
    case 'fill':
    case 'type':
      parts.push(`Could not enter text into "${target}". Verify the input selector exists and is editable at this point in the flow.`);
      break;
    case 'expectText':
      parts.push(`Expected text "${args.text}"${args.selector ? ` in "${args.selector}"` : ''} was not present. Look at the code that computes/renders that text (state update, template binding, formatting).`);
      break;
    case 'expectVisible':
      parts.push(`Expected element "${args.selector}" was not visible. Check the code path that should show it (conditional class/state, CSS display, async rendering).`);
      break;
    case 'waitFor':
      parts.push(`Timed out waiting for ${target || 'the condition'}. The expected state may never occur — trace the event/handler that should produce it.`);
      break;
    case 'press':
      parts.push(`Key press "${args.key}" did not produce the expected result. Check the keyboard handler.`);
      break;
    default:
      parts.push(`Step failed: ${detail || 'see detail'}. Inspect the related UI code.`);
      break;
  }

  if (detail) parts.push(`Reported: ${detail}`);
  if (consoleErrors.length) parts.push(`Console error(s) during this step: ${consoleErrors.map((e) => e.text).join(' | ')}`);
  if (networkErrors.length) parts.push(`Failed request(s) during this step: ${networkErrors.map((e) => `${e.method || 'GET'} ${e.url} -> ${e.status}`).join(' | ')}`);

  return parts.join(' ');
}

function mdEscape(v) {
  return String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function summarizeArgs(args = {}) {
  const entries = Object.entries(args)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
  return entries.join(', ');
}

/**
 * Render the full review-report.md as a string.
 * `paths` supplies absolute artifact locations (videoFile, runDir, ...).
 */
export function renderReport(log, paths = {}) {
  const verdict = computeVerdict(log);
  const meta = log.meta || {};
  const summary = log.summary || {};
  const steps = Array.isArray(log.steps) ? log.steps : [];
  const failed = steps.filter((s) => s.status === 'fail' || s.status === 'error');

  const lines = [];
  lines.push(`# Demo-drive review: ${meta.configName ?? 'run'}`);
  lines.push('');
  lines.push(`**Verdict: ${verdict}**`);
  lines.push('');
  lines.push(`- Run ID: \`${meta.runId ?? paths.runId ?? 'unknown'}\``);
  if (meta.baseUrl) lines.push(`- Base URL: ${meta.baseUrl}`);
  const diag = partitionDiagnostics(log);
  lines.push(`- Steps: ${summary.total ?? steps.length} total | ${summary.pass ?? 0} pass | ${summary.fail ?? 0} fail | ${summary.error ?? 0} error`);
  const consoleIgnored = diag.console.ignored.length;
  const networkIgnored = diag.network.ignored.length;
  lines.push(`- Console errors: ${diag.console.counted.length} counted${consoleIgnored ? ` (+${consoleIgnored} ignored)` : ''} | Failed network responses (>=400): ${diag.network.counted.length} counted${networkIgnored ? ` (+${networkIgnored} ignored)` : ''}`);
  if (consoleIgnored || networkIgnored) {
    lines.push('- Ignored diagnostics matched this config\'s `review.ignoreConsole` / `review.ignoreNetwork` patterns and do not affect the verdict.');
  }
  lines.push('');

  // The deliverable video. Playwright records a real WebM natively; the skill
  // transcodes it to an H.264 mp4, which is the primary artifact to show the
  // user. The WebM is retained as the source recording. video info (from the
  // transcode step) is carried in log.meta.video.
  const video = meta.video || {};
  const mp4Path = video.mp4 || (paths.mp4File ?? null);
  const webmPath = video.webm || paths.videoFile || '(video path unavailable)';
  const mp4Produced = !!video.mp4;
  if (mp4Produced) {
    lines.push('## Demo video (mp4 — show this to the user)');
    lines.push('');
    lines.push(`- **mp4 (deliverable):** \`${mp4Path}\``);
    lines.push(`- source recording (WebM): \`${webmPath}\``);
    lines.push('');
    const enc = video.mp4Encoder ? ` (encoder: ${video.mp4Encoder}${video.ffmpegSource ? `, via ${video.ffmpegSource}` : ''})` : '';
    lines.push(`The mp4 is the primary video to show/report to the user${enc}. It was transcoded with ffmpeg from the real WebM screen recording that Playwright captured; the WebM is kept as the source.`);
    lines.push('');
  } else {
    lines.push('## Demo video (real WebM — show this to the user)');
    lines.push('');
    lines.push(`- **WebM (deliverable):** \`${webmPath}\``);
    lines.push('');
    const why = video.mp4Reason ? ` mp4 was ${video.mp4Skipped ? 'skipped' : 'not produced'}: ${video.mp4Reason}.` : ' mp4 was not produced.';
    lines.push(`This WebM is the real recorded video of the run and is the artifact to show/report to the user.${why} Set DEMO_RECORDER_FFMPEG or install ffmpeg-static to enable the mp4 transcode.`);
    lines.push('');
  }

  // Per-step table.
  lines.push('## Steps');
  lines.push('');
  lines.push('| # | Action | Status | Duration (ms) | Args | Detail |');
  lines.push('| - | ------ | ------ | ------------- | ---- | ------ |');
  for (const s of steps) {
    lines.push(`| ${s.index} | ${mdEscape(s.action)} | ${statusIcon(s.status)} ${s.status} | ${s.durationMs ?? ''} | ${mdEscape(summarizeArgs(s.args))} | ${mdEscape(s.detail || '')} |`);
  }
  lines.push('');

  // Captured errors, split into counted (affect the verdict) and ignored
  // (matched the config's ignore patterns; shown for transparency only).
  if ((log.consoleErrors || []).length || (log.networkErrors || []).length) {
    lines.push('## Captured errors');
    lines.push('');
    if (diag.console.counted.length) {
      lines.push('### Console errors (counted)');
      lines.push('');
      for (const e of diag.console.counted) {
        lines.push(`- (step ${e.stepIndex ?? '?'}) ${mdEscape(e.text)}`);
      }
      lines.push('');
    }
    if (diag.network.counted.length) {
      lines.push('### Failed network responses (>=400, counted)');
      lines.push('');
      for (const e of diag.network.counted) {
        lines.push(`- (step ${e.stepIndex ?? '?'}) ${e.method || 'GET'} ${mdEscape(e.url)} -> ${e.status}`);
      }
      lines.push('');
    }
    if (diag.console.ignored.length) {
      lines.push('### Console errors (ignored by config)');
      lines.push('');
      for (const e of diag.console.ignored) {
        lines.push(`- (step ${e.stepIndex ?? '?'}) ${mdEscape(e.text)}`);
      }
      lines.push('');
    }
    if (diag.network.ignored.length) {
      lines.push('### Failed network responses (>=400, ignored by config)');
      lines.push('');
      for (const e of diag.network.ignored) {
        lines.push(`- (step ${e.stepIndex ?? '?'}) ${e.method || 'GET'} ${mdEscape(e.url)} -> ${e.status}`);
      }
      lines.push('');
    }
  }

  // Screenshots.
  lines.push('## Screenshots');
  lines.push('');
  const shots = steps.filter((s) => s.screenshot);
  if (shots.length) {
    for (const s of shots) {
      const flag = (s.status === 'fail' || s.status === 'error') ? ' **(failure)**' : '';
      lines.push(`- step ${s.index} (${s.action}, ${s.status})${flag}: \`${s.screenshot}\``);
    }
  } else {
    lines.push('- (none captured)');
  }
  lines.push('');

  // Failure analysis.
  if (failed.length) {
    lines.push('## Failure analysis (likely cause / where to look)');
    lines.push('');
    for (const s of failed) {
      lines.push(`### Step ${s.index}: ${s.action} — ${s.status}`);
      lines.push('');
      lines.push(hintForStep(s, log));
      if (s.screenshot) {
        lines.push('');
        lines.push(`Failure screenshot: \`${s.screenshot}\``);
      }
      lines.push('');
    }
  } else {
    lines.push('## Failure analysis');
    lines.push('');
    lines.push('No failed steps. The scenario ran clean.');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  const deliverableLabel = mp4Produced ? 'mp4' : 'WebM';
  lines.push(verdict === 'PASS'
    ? `Next: watch the ${deliverableLabel} to confirm the flow looks right, then report the video to the user.`
    : `Next: open the failure screenshot(s) and the ${deliverableLabel}, fix the product code indicated above, then re-run demo-run.mjs and review.mjs until the verdict is PASS.`);
  lines.push('');

  return lines.join('\n');
}

function statusIcon(status) {
  if (status === 'pass') return '✅';
  if (status === 'fail') return '❌';
  if (status === 'error') return '🔥';
  return '•';
}
