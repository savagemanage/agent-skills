// install.test.mjs — tests for the cross-tool installer (install-skill.mjs).
//
// These run install-skill.mjs as a subprocess. Most assertions use --dry-run so
// no filesystem changes are made; one test exercises a real --copy install into
// a throwaway temp dir and asserts the copied skill omits node_modules and that
// the default (no --copy) is a symlink resolving back to the canonical dir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, lstat, readlink, stat, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(__filename), '..');
const INSTALLER = path.join('scripts', 'install-skill.mjs');

function runInstaller(args) {
  return spawnSync('node', [INSTALLER, ...args], {
    cwd: SKILL_DIR,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('install --dry-run prints the correct per-tool target paths under --root', () => {
  const root = '/tmp/demo-recorder-install-target';
  const res = runInstaller(['--dry-run', '--root', root]);
  assert.equal(res.status, 0, res.stderr);
  // Default mode is symlink and it is announced as such.
  assert.match(res.stdout, /mode:\s+symlink/);
  // Each tool's target path is the documented <root>/<tool-dir>/skills/demo-recorder.
  assert.match(res.stdout, new RegExp(`symlink ${root}/\\.kiro/skills/demo-recorder -> `));
  assert.match(res.stdout, new RegExp(`symlink ${root}/\\.claude/skills/demo-recorder -> `));
  assert.match(res.stdout, new RegExp(`symlink ${root}/\\.opencode/skills/demo-recorder -> `));
  // Summary lists all three tools as planned.
  assert.match(res.stdout, /kiro: planned/);
  assert.match(res.stdout, /claude: planned/);
  assert.match(res.stdout, /opencode: planned/);
});

test('install --dry-run --tools selects a subset (and validates names)', () => {
  const res = runInstaller(['--dry-run', '--root', '/tmp/x', '--tools', 'kiro,claude']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /tools:\s+kiro, claude/);
  assert.doesNotMatch(res.stdout, /opencode: planned/);

  const bad = runInstaller(['--dry-run', '--tools', 'kiro,bogus']);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /unknown tool/);
});

test('install --dry-run --copy announces copy mode', () => {
  const res = runInstaller(['--dry-run', '--copy', '--root', '/tmp/x']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /mode:\s+copy/);
  assert.match(res.stdout, /copy .+ -> \/tmp\/x\/\.kiro\/skills\/demo-recorder/);
});

test('install --global --dry-run targets the home locations', () => {
  const res = runInstaller(['--dry-run', '--global', '--tools', 'opencode']);
  assert.equal(res.status, 0, res.stderr);
  const home = os.homedir();
  assert.match(res.stdout, new RegExp(`${home.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}/\\.config/opencode/skills/demo-recorder`));
});

test('install (default) creates a symlink to the canonical dir; --copy omits node_modules', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'demo-recorder-inst-'));
  try {
    // Default symlink install into a subset (kiro only) to keep it quick.
    const link = runInstaller(['--root', tmp, '--tools', 'kiro']);
    assert.equal(link.status, 0, link.stderr);
    const dest = path.join(tmp, '.kiro', 'skills', 'demo-recorder');
    const st = await lstat(dest);
    assert.ok(st.isSymbolicLink(), 'default install should be a symlink');
    assert.equal(await realpath(dest), await realpath(SKILL_DIR), 'symlink should resolve to the canonical skill dir');
    // The installer surfaces the dependency situation: either the prerequisite
    // reminder (deps missing) or a note that the canonical node_modules is present.
    assert.match(link.stdout, /Dependencies:|npm install/);

    // Copy install into a different tool dir; node_modules must be omitted.
    const copy = runInstaller(['--root', tmp, '--tools', 'claude', '--copy']);
    assert.equal(copy.status, 0, copy.stderr);
    const copyDest = path.join(tmp, '.claude', 'skills', 'demo-recorder');
    assert.ok((await stat(copyDest)).isDirectory(), 'copy install should be a real directory');
    assert.ok((await stat(path.join(copyDest, 'SKILL.md'))).isFile(), 'copied skill should contain SKILL.md');
    let hasNodeModules = true;
    try { await stat(path.join(copyDest, 'node_modules')); } catch { hasNodeModules = false; }
    assert.equal(hasNodeModules, false, 'copy install must omit node_modules');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
