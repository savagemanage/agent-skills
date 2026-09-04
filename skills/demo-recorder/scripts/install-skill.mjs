#!/usr/bin/env node
// install-skill.mjs — cross-tool installer for the canonical demo-recorder skill.
//
// Places (symlinks by default, or copies) the canonical skills/demo-recorder
// directory into each supported tool's skill-discovery location so the SAME
// SKILL.md works in Kiro, Claude Code, and opencode.
//
// Runtime prerequisite: the skill's browser engine depends on the `playwright`
// package installed in the canonical dir's node_modules. A symlink install
// shares that node_modules; a --copy install deliberately omits it. Either way,
// run `PLAYWRIGHT_BROWSERS_PATH=/opt/playwright npm install` in the canonical
// dir once before running the skill (the installer prints a reminder).
//
// Targets (per tool):
//   kiro     -> <root>/.kiro/skills/demo-recorder       (--global: ~/.kiro/skills/demo-recorder)
//   claude   -> <root>/.claude/skills/demo-recorder     (--global: ~/.claude/skills/demo-recorder)
//   opencode -> <root>/.opencode/skills/demo-recorder   (--global: ~/.config/opencode/skills/demo-recorder)
//
// Usage:
//   node scripts/install-skill.mjs [--root <dir>] [--global]
//                                  [--copy] [--dry-run]
//                                  [--tools kiro,claude,opencode]
//
//   --root <dir>   Install under <dir> instead of the current directory.
//   --global       Install into the user's home locations (uses os.homedir()).
//   --copy         Copy the skill directory instead of symlinking (default: symlink).
//   --dry-run      Print the planned actions without touching the filesystem.
//   --tools <csv>  Comma-separated subset of: kiro, claude, opencode.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { mkdir, cp, symlink, lstat, readlink, rm, realpath, stat } from 'node:fs/promises';

const SKILL_NAME = 'demo-recorder';
const ALL_TOOLS = ['kiro', 'claude', 'opencode'];

// The canonical skill directory is the parent of this scripts/ dir.
const __filename = fileURLToPath(import.meta.url);
const CANONICAL_DIR = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = { root: null, global: false, copy: false, dryRun: false, tools: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = argv[++i];
    else if (a === '--global') args.global = true;
    else if (a === '--copy') args.copy = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--tools') args.tools = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/install-skill.mjs [--root <dir>] [--global] [--copy] [--dry-run] [--tools kiro,claude,opencode]',
    '',
    '  --root <dir>   Install under <dir> (default: current working directory).',
    '  --global       Install into home locations (~/.kiro, ~/.claude, ~/.config/opencode).',
    '  --copy         Copy the skill instead of symlinking (default: symlink).',
    '  --dry-run      Print planned actions without writing.',
    '  --tools <csv>  Subset of tools: kiro, claude, opencode (default: all).',
  ].join('\n');
}

/** Compute the destination skill directory for a tool. */
function destForTool(tool, { root, global }) {
  if (global) {
    const home = os.homedir();
    switch (tool) {
      case 'kiro': return path.join(home, '.kiro', 'skills', SKILL_NAME);
      case 'claude': return path.join(home, '.claude', 'skills', SKILL_NAME);
      case 'opencode': return path.join(home, '.config', 'opencode', 'skills', SKILL_NAME);
      default: throw new Error(`unknown tool "${tool}"`);
    }
  }
  const base = path.resolve(root ?? process.cwd());
  switch (tool) {
    case 'kiro': return path.join(base, '.kiro', 'skills', SKILL_NAME);
    case 'claude': return path.join(base, '.claude', 'skills', SKILL_NAME);
    case 'opencode': return path.join(base, '.opencode', 'skills', SKILL_NAME);
    default: throw new Error(`unknown tool "${tool}"`);
  }
}

function resolveTools(csv) {
  if (!csv) return [...ALL_TOOLS];
  const requested = csv.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const invalid = requested.filter((t) => !ALL_TOOLS.includes(t));
  if (invalid.length) throw new Error(`unknown tool(s): ${invalid.join(', ')}. Valid: ${ALL_TOOLS.join(', ')}`);
  // De-dupe while preserving order.
  return [...new Set(requested)];
}

/** Describe what currently exists at dest (for reporting / idempotency). */
async function inspect(dest) {
  try {
    const st = await lstat(dest);
    if (st.isSymbolicLink()) {
      const target = await readlink(dest);
      return { exists: true, kind: 'symlink', target };
    }
    return { exists: true, kind: st.isDirectory() ? 'dir' : 'file' };
  } catch {
    return { exists: false };
  }
}

async function installOne(tool, opts) {
  const dest = destForTool(tool, opts);
  const mode = opts.copy ? 'copy' : 'symlink';
  const existing = await inspect(dest);

  const actions = [];

  // If a correct symlink already points at the canonical dir, treat as no-op.
  if (!opts.copy && existing.exists && existing.kind === 'symlink') {
    let resolved = existing.target;
    try { resolved = await realpath(dest); } catch { /* dangling */ }
    if (resolved === CANONICAL_DIR) {
      console.log(`[${tool}] up-to-date symlink: ${dest} -> ${CANONICAL_DIR}`);
      return { tool, dest, mode, status: 'up-to-date' };
    }
  }

  const parent = path.dirname(dest);
  actions.push(`mkdir -p ${parent}`);
  if (existing.exists) actions.push(`remove existing ${existing.kind} at ${dest}`);
  actions.push(opts.copy ? `copy ${CANONICAL_DIR} -> ${dest}` : `symlink ${dest} -> ${CANONICAL_DIR}`);

  if (opts.dryRun) {
    console.log(`[${tool}] (dry-run) ${mode}:`);
    for (const act of actions) console.log(`  - ${act}`);
    return { tool, dest, mode, status: 'planned' };
  }

  await mkdir(parent, { recursive: true });
  if (existing.exists) {
    await rm(dest, { recursive: true, force: true });
  }
  if (opts.copy) {
    await cp(CANONICAL_DIR, dest, {
      recursive: true,
      // Do not copy heavy/transient dirs.
      filter: (src) => {
        const base = path.basename(src);
        return base !== 'node_modules';
      },
    });
    console.log(`[${tool}] copied -> ${dest}`);
  } else {
    await symlink(CANONICAL_DIR, dest, 'dir');
    console.log(`[${tool}] symlinked ${dest} -> ${CANONICAL_DIR}`);
  }
  return { tool, dest, mode, status: 'installed' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  let tools;
  try {
    tools = resolveTools(args.tools);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const opts = { root: args.root, global: args.global, copy: args.copy, dryRun: args.dryRun };

  console.log(`demo-recorder install${args.dryRun ? ' (dry-run)' : ''}`);
  console.log(`  canonical:   ${CANONICAL_DIR}`);
  console.log(`  mode:        ${args.copy ? 'copy' : 'symlink'}`);
  console.log(`  scope:       ${args.global ? 'global (home)' : `root=${path.resolve(args.root ?? process.cwd())}`}`);
  console.log(`  tools:       ${tools.join(', ')}`);
  console.log('');

  const results = [];
  for (const tool of tools) {
    results.push(await installOne(tool, opts));
  }

  console.log('');
  console.log('Summary:');
  for (const r of results) {
    console.log(`  ${r.tool}: ${r.status} (${r.mode}) ${r.dest}`);
  }

  // Runtime dependency reminder. The skill can only launch a browser once the
  // canonical dir has its node_modules (playwright) populated. A --copy install
  // omits node_modules by design; a fresh symlink into an un-installed checkout
  // shares an empty node_modules. Surface the prerequisite either way.
  let depsPresent = false;
  try {
    depsPresent = (await stat(path.join(CANONICAL_DIR, 'node_modules', 'playwright'))).isDirectory();
  } catch { depsPresent = false; }
  console.log('');
  if (depsPresent && !args.copy) {
    console.log('Dependencies: canonical node_modules present; symlinked installs share it.');
  } else {
    console.log('Next step (required before running): install the skill dependencies in the canonical dir:');
    console.log(`  (cd ${CANONICAL_DIR} && PLAYWRIGHT_BROWSERS_PATH=/opt/playwright npm install)`);
    if (args.copy) {
      console.log('  A --copy install omits node_modules by design, so run this from the copied dir instead if you plan to run it there.');
    }
  }
}

main().catch((err) => {
  console.error(`demo-recorder install error: ${err.stack || err.message}`);
  process.exit(1);
});
