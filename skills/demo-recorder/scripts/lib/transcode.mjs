// transcode.mjs — locate ffmpeg and transcode the recorded WebM into an mp4.
//
// Playwright records a REAL video natively as WebM (VP8). That WebM is the
// source recording and is never replaced. After a run finishes, the skill
// transcodes it to an H.264 mp4 so the deliverable video is a broadly playable
// .mp4 (the format users actually want to share/embed).
//
// The transcode is best-effort and resilient: if ffmpeg cannot be located, or
// the transcode fails, the run is NOT aborted — the WebM is kept and the caller
// records that mp4 was skipped (with a reason) so the review report can say so.
//
// ffmpeg resolution order (first that exists wins):
//   1. env DEMO_RECORDER_FFMPEG              (explicit override; absolute path)
//   2. the `ffmpeg-static` npm module        (bundled full ffmpeg WITH libx264)
//   3. /opt/playwright/ffmpeg-1011/ffmpeg-linux (Playwright's bundled ffmpeg)
//   4. `ffmpeg` on PATH
//
// IMPORTANT: Playwright's bundled ffmpeg is built with `--disable-everything`
// and only ships the libvpx (VP8) encoder + webm/image2 muxers — it CANNOT
// produce an mp4/H.264 file. `ffmpeg-static` is therefore listed as a runtime
// dependency and is the reliable source of an H.264-capable ffmpeg here. The
// Playwright/PATH entries remain as fallbacks in case a full ffmpeg is present
// (they are only used if they actually support the chosen encoder).

import { access, constants, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Playwright's bundled ffmpeg (present in this sandbox). WebM/VP8 only.
export const PLAYWRIGHT_FFMPEG = '/opt/playwright/ffmpeg-1011/ffmpeg-linux';

async function isExecutableFile(p) {
  try {
    const s = await stat(p);
    if (!s.isFile()) return false;
    await access(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve the path exported by the `ffmpeg-static` module, if installed. */
function ffmpegStaticPath() {
  try {
    const p = require('ffmpeg-static');
    return typeof p === 'string' && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

/**
 * Resolve an ffmpeg binary to use for the transcode.
 * Returns { path, source } or null if none is usable.
 * `source` is one of 'env' | 'ffmpeg-static' | 'playwright' | 'path'.
 */
export async function resolveFfmpeg(env = process.env) {
  // 1) Explicit override.
  const override = env?.DEMO_RECORDER_FFMPEG;
  if (typeof override === 'string' && override.trim().length > 0) {
    const p = override.trim();
    if (await isExecutableFile(p)) return { path: p, source: 'env' };
  }

  // 2) ffmpeg-static (full ffmpeg with libx264 + mp4 muxer).
  const staticPath = ffmpegStaticPath();
  if (staticPath && (await isExecutableFile(staticPath))) {
    return { path: staticPath, source: 'ffmpeg-static' };
  }

  // 3) Playwright's bundled ffmpeg (WebM/VP8 only — usually cannot make mp4).
  if (await isExecutableFile(PLAYWRIGHT_FFMPEG)) {
    return { path: PLAYWRIGHT_FFMPEG, source: 'playwright' };
  }

  // 4) `ffmpeg` on PATH — let spawn resolve it; probe by running -version.
  const onPath = await which('ffmpeg', env);
  if (onPath) return { path: 'ffmpeg', source: 'path' };

  return null;
}

/** Return true if `ffmpeg` resolves on PATH (via a -version probe). */
function which(bin, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(bin, ['-version'], { env, stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

/** Run ffmpeg with the given args; resolve with { code, stderr }. */
function runFfmpeg(ffmpegPath, args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => resolve({ code: -1, stderr: err.message }));
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

/**
 * Transcode a WebM to an H.264 mp4.
 *
 * Returns a result object describing what happened (never throws for the
 * expected failure modes — the caller keeps the WebM and reports the reason):
 *   { ok: true,  mp4Path, ffmpeg: {path, source} }
 *   { ok: false, skipped: true|false, reason, ffmpeg? }
 *
 * `skipped: true`  -> ffmpeg was not found (mp4 intentionally not produced).
 * `skipped: false` -> ffmpeg ran but failed (transcode error).
 */
export async function transcodeToMp4(webmPath, mp4Path, opts = {}) {
  const env = opts.env ?? process.env;

  if (!(await isExecutableFile(webmPath).catch(() => false)) && !(await pathExists(webmPath))) {
    return { ok: false, skipped: false, reason: `source WebM not found at ${webmPath}` };
  }

  const ffmpeg = opts.ffmpeg ?? (await resolveFfmpeg(env));
  if (!ffmpeg) {
    return {
      ok: false,
      skipped: true,
      reason: 'ffmpeg not found (set DEMO_RECORDER_FFMPEG, install ffmpeg-static, or put ffmpeg on PATH)',
    };
  }

  // Preferred encoder: libx264 into an mp4 (H.264, widely playable).
  const baseArgs = ['-y', '-i', webmPath];
  const h264Args = [...baseArgs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path];

  let res = await runFfmpeg(ffmpeg.path, h264Args, env);
  if (res.code === 0 && (await pathExists(mp4Path))) {
    return { ok: true, mp4Path, ffmpeg, encoder: 'libx264' };
  }

  // Fallback: some ffmpeg builds (e.g. Playwright's) lack libx264. Try mpeg4,
  // which is available in more minimal builds and still yields a playable mp4.
  const mpeg4Args = [...baseArgs, '-c:v', 'mpeg4', '-q:v', '3', mp4Path];
  const res2 = await runFfmpeg(ffmpeg.path, mpeg4Args, env);
  if (res2.code === 0 && (await pathExists(mp4Path))) {
    return { ok: true, mp4Path, ffmpeg, encoder: 'mpeg4', fallbackFrom: 'libx264' };
  }

  return {
    ok: false,
    skipped: false,
    ffmpeg,
    reason: `ffmpeg transcode failed (libx264 exit ${res.code}, mpeg4 exit ${res2.code}). ` +
      `Last stderr: ${(res2.stderr || res.stderr || '').trim().split('\n').slice(-3).join(' ')}`.trim(),
  };
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
