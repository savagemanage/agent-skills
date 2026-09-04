// config.mjs — load and validate a demo.config.json describing the target project.
//
// Besides launch/scenario, the config supports "watchability" knobs so the
// recorded video is easy for a human to follow:
//   - stepDelayMs (number): pause between scenario steps (default 700ms).
//   - slowMo (number): Playwright slowMo, ms added inside each browser action
//     (default 250ms) so clicks/typing are visibly slower.
//   - showCursor (boolean): inject a synthetic mouse cursor overlay that glides
//     to each target before clicking (default true; headless has no real cursor).
//
// Pure helpers (no browser / no filesystem side effects beyond reading the config file)
// so they can be unit-tested in isolation and reused by later features (review, install).

import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Scenario actions supported by the engine. Each entry lists the required
 * argument keys (at least one of the alternatives, expressed as groups).
 */
const SCENARIO_ACTIONS = new Set([
  'goto',
  'click',
  'fill',
  'type',
  'press',
  'waitFor',
  'expectText',
  'expectVisible',
  'screenshot',
  'snapshot',
]);

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function assert(condition, message) {
  if (!condition) throw new ConfigError(message);
}

/**
 * Validate a scenario step object, returning a normalized copy.
 * Throws ConfigError with a clear, indexed message on any problem.
 */
export function validateStep(step, index) {
  const where = `scenario[${index}]`;
  assert(step && typeof step === 'object' && !Array.isArray(step), `${where} must be an object`);
  assert(typeof step.action === 'string', `${where}.action must be a string`);
  assert(SCENARIO_ACTIONS.has(step.action), `${where}.action "${step.action}" is not supported. Supported: ${[...SCENARIO_ACTIONS].join(', ')}`);

  const hasSelectorTarget = (s) => typeof s.selector === 'string' || typeof s.text === 'string' || (typeof s.role === 'string' && typeof s.name === 'string');

  switch (step.action) {
    case 'goto':
      assert(typeof step.url === 'string' && step.url.length > 0, `${where} (goto) requires a "url" string`);
      break;
    case 'click':
      assert(hasSelectorTarget(step), `${where} (click) requires "selector", "text", or "role"+"name"`);
      break;
    case 'fill':
      assert(typeof step.selector === 'string', `${where} (fill) requires a "selector" string`);
      assert(typeof step.value === 'string', `${where} (fill) requires a "value" string`);
      break;
    case 'type':
      assert(typeof step.selector === 'string', `${where} (type) requires a "selector" string`);
      assert(typeof step.value === 'string', `${where} (type) requires a "value" string`);
      break;
    case 'press':
      assert(typeof step.key === 'string' && step.key.length > 0, `${where} (press) requires a "key" string`);
      break;
    case 'waitFor':
      assert(
        typeof step.selector === 'string' || typeof step.text === 'string' || typeof step.url === 'string' || typeof step.ms === 'number',
        `${where} (waitFor) requires one of "selector", "text", "url", or "ms"`,
      );
      break;
    case 'expectText':
      assert(typeof step.text === 'string' && step.text.length > 0, `${where} (expectText) requires a "text" string`);
      break;
    case 'expectVisible':
      assert(typeof step.selector === 'string', `${where} (expectVisible) requires a "selector" string`);
      break;
    case 'screenshot':
    case 'snapshot':
      // label is optional; nothing strictly required.
      break;
    default:
      // Unreachable due to the SCENARIO_ACTIONS check above.
      break;
  }
  return step;
}

/**
 * Validate the optional `review` block. Lets a config declare console/network
 * diagnostics that are incidental noise (e.g. a favicon 404, a third-party
 * console warning) so they do not flip an otherwise-passing demo to FAIL.
 * Returns a normalized copy (arrays of non-empty strings) or undefined.
 *
 * - ignoreConsole: string patterns matched (as regex, case-insensitive) against
 *   each captured console error's text.
 * - ignoreNetwork: string patterns matched (as regex, case-insensitive) against
 *   "<STATUS> <METHOD> <URL>" for each failed (>=400) response, so a pattern can
 *   target a URL, a method, a status code, or any combination.
 */
export function validateReview(review) {
  if (review == null) return undefined;
  assert(typeof review === 'object' && !Array.isArray(review), 'review must be an object');
  const normArray = (val, key) => {
    if (val == null) return [];
    assert(Array.isArray(val), `review.${key} must be an array of strings`);
    return val.map((p, i) => {
      assert(typeof p === 'string' && p.length > 0, `review.${key}[${i}] must be a non-empty string`);
      // Validate the pattern compiles as a regex so bad configs fail early.
      try { new RegExp(p, 'i'); } catch (err) { throw new ConfigError(`review.${key}[${i}] is not a valid regex: ${err.message}`); }
      return p;
    });
  };
  const ignoreConsole = normArray(review.ignoreConsole, 'ignoreConsole');
  const ignoreNetwork = normArray(review.ignoreNetwork, 'ignoreNetwork');
  if (ignoreConsole.length === 0 && ignoreNetwork.length === 0) return undefined;
  return { ignoreConsole, ignoreNetwork };
}

/**
 * Validate a launch block (optional). Returns a normalized copy.
 */
export function validateLaunch(launch) {
  if (launch == null) return undefined;
  assert(typeof launch === 'object' && !Array.isArray(launch), 'launch must be an object');
  assert(typeof launch.command === 'string' && launch.command.length > 0, 'launch.command must be a non-empty string');
  if (launch.cwd != null) assert(typeof launch.cwd === 'string', 'launch.cwd must be a string');
  const readySignals = ['readyUrl', 'readyPort', 'readyLog'].filter((k) => launch[k] != null);
  assert(readySignals.length >= 1, 'launch requires one readiness signal: readyUrl, readyPort, or readyLog');
  if (launch.readyUrl != null) assert(typeof launch.readyUrl === 'string', 'launch.readyUrl must be a string');
  if (launch.readyPort != null) assert(Number.isInteger(launch.readyPort), 'launch.readyPort must be an integer');
  if (launch.readyLog != null) assert(typeof launch.readyLog === 'string', 'launch.readyLog must be a string');
  if (launch.timeoutMs != null) assert(Number.isFinite(launch.timeoutMs) && launch.timeoutMs > 0, 'launch.timeoutMs must be a positive number');
  return launch;
}

/**
 * Validate an already-parsed config object. Returns a normalized copy with
 * defaults applied. `sourcePath` is used to resolve a relative launch.cwd.
 */
export function validateConfig(config, sourcePath) {
  assert(config && typeof config === 'object' && !Array.isArray(config), 'config must be a JSON object');
  assert(typeof config.name === 'string' && config.name.length > 0, 'config.name must be a non-empty string');
  assert(typeof config.baseUrl === 'string' && config.baseUrl.length > 0, 'config.baseUrl must be a non-empty string');
  assert(Array.isArray(config.scenario) && config.scenario.length > 0, 'config.scenario must be a non-empty array');

  const launch = validateLaunch(config.launch);

  // Resolve launch.cwd relative to the config file's directory when provided.
  let resolvedLaunch = launch;
  if (launch) {
    const baseDir = sourcePath ? path.dirname(path.resolve(sourcePath)) : process.cwd();
    resolvedLaunch = {
      ...launch,
      cwd: launch.cwd ? path.resolve(baseDir, launch.cwd) : baseDir,
      timeoutMs: launch.timeoutMs ?? 30000,
    };
  }

  let viewport = { width: 1280, height: 720 };
  if (config.viewport != null) {
    assert(
      typeof config.viewport === 'object' && Number.isInteger(config.viewport.width) && Number.isInteger(config.viewport.height),
      'config.viewport must be { width:int, height:int }',
    );
    viewport = { width: config.viewport.width, height: config.viewport.height };
  }

  const review = validateReview(config.review);

  // Watchability knobs (all optional, with sensible defaults chosen so the
  // recorded video is easy for a human to follow).
  let stepDelayMs = 700;
  if (config.stepDelayMs != null) {
    assert(Number.isFinite(config.stepDelayMs) && config.stepDelayMs >= 0, 'config.stepDelayMs must be a non-negative number');
    stepDelayMs = config.stepDelayMs;
  }

  let slowMo = 250;
  if (config.slowMo != null) {
    assert(Number.isFinite(config.slowMo) && config.slowMo >= 0, 'config.slowMo must be a non-negative number');
    slowMo = config.slowMo;
  }

  let showCursor = true;
  if (config.showCursor != null) {
    assert(typeof config.showCursor === 'boolean', 'config.showCursor must be a boolean');
    showCursor = config.showCursor;
  }

  const scenario = config.scenario.map((step, i) => validateStep(step, i));

  return {
    name: config.name,
    baseUrl: config.baseUrl,
    viewport,
    launch: resolvedLaunch,
    review,
    stepDelayMs,
    slowMo,
    showCursor,
    scenario,
  };
}

/**
 * Load and validate a demo.config.json from disk.
 */
export async function loadConfig(configPath) {
  assert(typeof configPath === 'string' && configPath.length > 0, 'a config path is required');
  const abs = path.resolve(configPath);
  let raw;
  try {
    raw = await readFile(abs, 'utf8');
  } catch (err) {
    throw new ConfigError(`could not read config file at ${abs}: ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`config file at ${abs} is not valid JSON: ${err.message}`);
  }
  return validateConfig(parsed, abs);
}

export { ConfigError, SCENARIO_ACTIONS };
