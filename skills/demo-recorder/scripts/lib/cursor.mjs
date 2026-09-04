// cursor.mjs — a visible synthetic mouse cursor for headless recordings.
//
// Headless Chromium has no visible OS cursor, so a recorded video shows things
// happening with no pointer. This module injects a fixed-position SVG cursor
// overlay into the page that follows the real Playwright mouse (via a mousemove
// listener), and provides a glide() helper that animates page.mouse.move in
// small steps so the cursor visibly travels to a target and lands on it before
// a click. This makes the recording easy for a human to follow without changing
// what the scenario actually does.

// The overlay is (re)installed on every navigation via an init script so it
// survives page loads. It listens for a custom event to render a brief "click"
// ripple as well.
const CURSOR_INIT_SCRIPT = `(() => {
  if (window.__demoRecorderCursorInstalled) return;
  window.__demoRecorderCursorInstalled = true;

  const ID = '__demo_recorder_cursor__';
  function ensureCursor() {
    if (!document.body) return null;
    let el = document.getElementById(ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = ID;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:24px',
      'height:24px',
      'margin-left:-3px',
      'margin-top:-3px',
      'z-index:2147483647',
      'pointer-events:none',
      'transition:transform 0.02s linear',
      'will-change:transform',
    ].join(';');
    el.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" '
      + 'fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(el);
    return el;
  }

  function move(x, y) {
    const el = ensureCursor();
    if (el) el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  // Follow the real (Playwright-driven) mouse.
  window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY), true);

  // Render a brief click ripple centered on the cursor.
  window.addEventListener('__demoRecorderClick', (e) => {
    const d = e.detail || {};
    const r = document.createElement('div');
    r.style.cssText = [
      'position:fixed',
      'left:' + (d.x || 0) + 'px',
      'top:' + (d.y || 0) + 'px',
      'width:8px',
      'height:8px',
      'margin-left:-4px',
      'margin-top:-4px',
      'border-radius:50%',
      'border:2px solid rgba(20,120,255,0.9)',
      'background:rgba(20,120,255,0.25)',
      'z-index:2147483646',
      'pointer-events:none',
      'transition:transform 0.35s ease-out, opacity 0.35s ease-out',
    ].join(';');
    document.body.appendChild(r);
    requestAnimationFrame(() => {
      r.style.transform = 'scale(4)';
      r.style.opacity = '0';
    });
    setTimeout(() => r.remove(), 400);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureCursor);
  } else {
    ensureCursor();
  }
})();`;

/**
 * Install the synthetic cursor overlay on a context/page. Adds an init script so
 * the overlay is (re)created on every navigation, and injects it into the
 * already-loaded page too. Best-effort; failures never break the run.
 */
export async function installCursor(context, page) {
  try {
    await context.addInitScript(CURSOR_INIT_SCRIPT);
  } catch { /* ignore */ }
  try {
    await page.evaluate(CURSOR_INIT_SCRIPT);
  } catch { /* the page may not have loaded yet; init script covers it */ }
}

/** Simple ease-in-out for a natural-looking glide. */
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Glide the real Playwright mouse from its last position to (x, y) in several
 * interpolated steps so the injected cursor visibly travels across the screen.
 * Tracks the last position on the page object so consecutive glides are smooth.
 */
export async function glideMouseTo(page, x, y, { steps = 24, totalMs = 500 } = {}) {
  const from = page.__demoRecorderMouse || { x: 0, y: 0 };
  const perStep = Math.max(0, Math.round(totalMs / Math.max(1, steps)));
  for (let i = 1; i <= steps; i++) {
    const t = easeInOut(i / steps);
    const cx = from.x + (x - from.x) * t;
    const cy = from.y + (y - from.y) * t;
    await page.mouse.move(cx, cy);
    if (perStep) await page.waitForTimeout(perStep);
  }
  page.__demoRecorderMouse = { x, y };
}

/**
 * Move the cursor to the center of a located element (gliding), pausing briefly
 * so the landing is visible in the recording. Returns the target center or null
 * if the element has no box. Best-effort.
 */
export async function glideToLocator(page, locator, opts = {}) {
  let box = null;
  try {
    box = await locator.first().boundingBox();
  } catch { box = null; }
  if (!box) return null;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await glideMouseTo(page, x, y, opts);
  return { x, y };
}

/** Trigger the click ripple overlay at the current cursor position. */
export async function showClickRipple(page) {
  const pos = page.__demoRecorderMouse || { x: 0, y: 0 };
  try {
    await page.evaluate(
      (p) => window.dispatchEvent(new CustomEvent('__demoRecorderClick', { detail: p })),
      pos,
    );
  } catch { /* ignore */ }
}
