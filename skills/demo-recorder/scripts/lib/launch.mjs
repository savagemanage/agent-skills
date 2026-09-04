// launch.mjs — optionally spawn the target app process and wait until it is ready.
//
// If config.launch is present, spawn the command (via a shell so users can write
// natural commands like "node server.mjs"), then poll for readiness using one of:
//   - readyUrl:  HTTP GET returns any response (connection succeeds)
//   - readyPort: a TCP connection to 127.0.0.1:<port> succeeds
//   - readyLog:  a substring appears in the process stdout/stderr
// Exposes stop() which kills the whole process group/tree.
//
// If there is no launch block, the caller should treat baseUrl as already running.

import { spawn } from 'node:child_process';
import net from 'node:net';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    // Any HTTP response (even 404/500) means the server is up.
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return !!res;
  } catch {
    return false;
  }
}

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(2000, () => done(false));
  });
}

/**
 * Launch the app described by `launch` (already-validated). Returns a handle
 * { stop, pid, output } once the app is ready. Throws on spawn failure or
 * readiness timeout.
 */
export async function launchApp(launch, { onLog } = {}) {
  const child = spawn(launch.command, {
    cwd: launch.cwd,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group so we can kill the whole tree
    env: process.env,
  });

  let output = '';
  let logMatched = false;
  const collect = (buf) => {
    const s = buf.toString();
    output += s;
    if (launch.readyLog && s.includes(launch.readyLog)) logMatched = true;
    if (onLog) onLog(s);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  let exited = false;
  let exitInfo = null;
  child.on('exit', (code, signal) => {
    exited = true;
    exitInfo = { code, signal };
  });

  const stop = async () => {
    if (exited || child.pid == null) return;
    try {
      // Kill the whole process group (negative pid) since detached:true.
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try { child.kill('SIGTERM'); } catch { /* already gone */ }
    }
    // Give it a moment, then force kill if still alive.
    for (let i = 0; i < 20 && !exited; i++) await sleep(100);
    if (!exited) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* ignore */ }
    }
  };

  const timeoutMs = launch.timeoutMs ?? 30000;
  const deadline = Date.now() + timeoutMs;

  try {
    // Wait for spawn errors to surface (e.g. command not found).
    await new Promise((resolve, reject) => {
      const onErr = (err) => reject(new Error(`failed to spawn launch command "${launch.command}": ${err.message}`));
      child.once('error', onErr);
      setTimeout(() => {
        child.removeListener('error', onErr);
        resolve();
      }, 200);
    });

    while (Date.now() < deadline) {
      if (exited) {
        throw new Error(`launch command exited before becoming ready (code=${exitInfo?.code}, signal=${exitInfo?.signal}). Output:\n${output.slice(-2000)}`);
      }
      let ready = false;
      if (launch.readyLog) ready = logMatched;
      else if (launch.readyUrl) ready = await checkUrl(launch.readyUrl);
      else if (launch.readyPort != null) ready = await checkPort(launch.readyPort);
      if (ready) {
        return { stop, pid: child.pid, get output() { return output; } };
      }
      await sleep(250);
    }
    throw new Error(`launch command did not become ready within ${timeoutMs}ms. Output:\n${output.slice(-2000)}`);
  } catch (err) {
    await stop();
    throw err;
  }
}
