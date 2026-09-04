#!/usr/bin/env node
// review.mjs — review a completed demo-recorder run and write review-report.md.
//
// Reads a run's action-log.json, correlates it with captured console/network
// errors and screenshots, and produces a human/agent-readable review report so
// an agent can judge pass/fail, locate the failing step, and drive fixes.
//
// Usage:
//   node scripts/review.mjs [--run <runId | artifact dir>]
//
//   --run <runId|dir>   The run to review. May be a runId (a directory name
//                       under the artifacts root) or a path to the
//                       run's artifact directory. Defaults to the most recent
//                       run under the artifacts root.
//
// Exits non-zero when the verdict is FAIL.

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { resolveArtifactsRoot, buildRunPathsFromDir } from './lib/paths.mjs';
import { computeVerdict, renderReport } from './lib/review.mjs';

// Resolved at process start; honors DEMO_RECORDER_ARTIFACTS_ROOT.
const ARTIFACTS_ROOT = resolveArtifactsRoot();

function parseArgs(argv) {
  const args = { run: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') args.run = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/review.mjs [--run <runId | artifact dir>]',
    '',
    '  --run <runId|dir>   Run to review (runId under the artifacts root, or a',
    '                      path to the run dir). Defaults to the latest run.',
    '',
    `Artifacts root: ${ARTIFACTS_ROOT}`,
    '  (override with the DEMO_RECORDER_ARTIFACTS_ROOT env var)',
  ].join('\n');
}

/** Find the most recent run directory under the artifacts root. */
async function findLatestRunDir() {
  let entries;
  try {
    entries = await readdir(ARTIFACTS_ROOT, { withFileTypes: true });
  } catch {
    throw new Error(`no artifacts found at ${ARTIFACTS_ROOT}. Run demo-run.mjs first.`);
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => path.join(ARTIFACTS_ROOT, e.name));
  if (dirs.length === 0) throw new Error(`no run directories under ${ARTIFACTS_ROOT}. Run demo-run.mjs first.`);
  const withTimes = await Promise.all(
    dirs.map(async (d) => ({ dir: d, mtime: (await stat(d)).mtimeMs })),
  );
  withTimes.sort((a, b) => b.mtime - a.mtime);
  return withTimes[0].dir;
}

/** Resolve --run (runId or path) to an absolute run directory. */
async function resolveRunDir(run) {
  if (!run) return findLatestRunDir();
  // Absolute or relative path to an existing directory?
  const asPath = path.resolve(run);
  try {
    if ((await stat(asPath)).isDirectory()) return asPath;
  } catch { /* not a path; treat as runId */ }
  // Treat as a runId under the artifacts root.
  const asRunId = path.join(ARTIFACTS_ROOT, run);
  try {
    if ((await stat(asRunId)).isDirectory()) return asRunId;
  } catch { /* fall through */ }
  throw new Error(`could not resolve run "${run}" (not a directory and not a runId under ${ARTIFACTS_ROOT}).`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const runDir = await resolveRunDir(args.run);
  const runId = path.basename(runDir);
  // Derive artifact paths from the RESOLVED run dir, not the artifacts root, so
  // reviewing a run that lives outside ARTIFACTS_ROOT writes review-report.md
  // and reports the video path inside that same run dir.
  const paths = buildRunPathsFromDir(runDir, { runId });

  const logPath = paths.actionLogFile;
  let log;
  try {
    log = JSON.parse(await readFile(logPath, 'utf8'));
  } catch (err) {
    throw new Error(`could not read/parse action-log.json at ${logPath}: ${err.message}`);
  }

  const verdict = computeVerdict(log);
  const report = renderReport(log, paths);
  await writeFile(paths.reviewReportFile, report, 'utf8');

  console.log('');
  console.log(`demo-recorder review: ${runId}`);
  console.log(`  verdict:     ${verdict}`);
  console.log(`  report:      ${paths.reviewReportFile}`);
  console.log(`  video:       ${paths.videoFile}`);
  const summary = log.summary || {};
  console.log(`  steps:       ${summary.total ?? '?'} total | ${summary.pass ?? 0} pass | ${summary.fail ?? 0} fail | ${summary.error ?? 0} error`);
  console.log('');

  process.exit(verdict === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(`demo-recorder review error: ${err.stack || err.message}`);
  process.exit(2);
});
