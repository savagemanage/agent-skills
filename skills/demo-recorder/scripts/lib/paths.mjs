// paths.mjs — build absolute artifact paths for a single demo-recorder run.
//
// All paths are absolute (never rely on ~ expansion). Runtime artifacts live under
// <ARTIFACTS_ROOT>/<runId>/ where runId = <timestamp>-<config-name-slug>.
//
// ARTIFACTS_ROOT is overridable so the skill stays portable after a --global or
// other-repo install (where the default path may not exist or be writable).
// Resolution order:
//   1. env DEMO_RECORDER_ARTIFACTS_ROOT (absolute, or resolved against cwd)
//   2. the default location <cwd>/.demo-recorder/artifacts
// A per-call override is also accepted via buildRunPaths({ artifactsRoot }).

import path from 'node:path';
import { mkdir } from 'node:fs/promises';

// The default artifacts location, relative to the current working directory so
// the skill is portable (works wherever it is installed). Override with the
// DEMO_RECORDER_ARTIFACTS_ROOT env var to place runs somewhere specific.
export const DEFAULT_ARTIFACTS_ROOT = path.resolve(process.cwd(), '.demo-recorder', 'artifacts');

/**
 * Resolve the artifacts root, honoring an env override when present.
 * Kept as a function so callers/tests can resolve at call time; the exported
 * ARTIFACTS_ROOT constant captures the value at module load for back-compat.
 */
export function resolveArtifactsRoot(env = process.env) {
  const override = env?.DEMO_RECORDER_ARTIFACTS_ROOT;
  if (typeof override === 'string' && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  return DEFAULT_ARTIFACTS_ROOT;
}

// Resolved once at module load. Overridable via DEMO_RECORDER_ARTIFACTS_ROOT.
export const ARTIFACTS_ROOT = resolveArtifactsRoot();

/**
 * Slugify a config name into a filesystem-safe token.
 */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'demo';
}

/**
 * Build a runId from a config name and an optional Date (defaults to now).
 * Timestamp format: YYYYMMDD-HHMMSS (UTC), safe for filenames and sortable.
 */
export function buildRunId(configName, now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${ts}-${slugify(configName)}`;
}

/**
 * Compute all artifact paths for a run. Pure function — does not touch disk.
 */
export function buildRunPaths(configName, opts = {}) {
  const runId = opts.runId ?? buildRunId(configName, opts.now);
  const root = opts.artifactsRoot ?? resolveArtifactsRoot();
  const runDir = path.join(root, runId);
  return {
    runId,
    runDir,
    videoDir: path.join(runDir, 'video'),
    videoFile: path.join(runDir, 'video', 'demo.webm'),
    mp4File: path.join(runDir, 'video', 'demo.mp4'),
    screenshotsDir: path.join(runDir, 'screenshots'),
    snapshotsDir: path.join(runDir, 'snapshots'),
    actionLogFile: path.join(runDir, 'action-log.json'),
    reviewReportFile: path.join(runDir, 'review-report.md'),
  };
}

/**
 * Build all artifact paths from an already-resolved run directory. Pure.
 *
 * Unlike buildRunPaths (which roots everything at the artifacts root), this
 * derives every artifact path from the given runDir, so it is correct for runs
 * that live outside the artifacts root (e.g. review.mjs --run <external dir>).
 * runId defaults to the run dir's basename.
 */
export function buildRunPathsFromDir(runDir, opts = {}) {
  const abs = path.resolve(runDir);
  const runId = opts.runId ?? path.basename(abs);
  return {
    runId,
    runDir: abs,
    videoDir: path.join(abs, 'video'),
    videoFile: path.join(abs, 'video', 'demo.webm'),
    mp4File: path.join(abs, 'video', 'demo.mp4'),
    screenshotsDir: path.join(abs, 'screenshots'),
    snapshotsDir: path.join(abs, 'snapshots'),
    actionLogFile: path.join(abs, 'action-log.json'),
    reviewReportFile: path.join(abs, 'review-report.md'),
  };
}

/**
 * Create the directories needed for a run. Returns the same paths object.
 */
export async function ensureRunDirs(paths) {
  await mkdir(paths.videoDir, { recursive: true });
  await mkdir(paths.screenshotsDir, { recursive: true });
  await mkdir(paths.snapshotsDir, { recursive: true });
  return paths;
}
