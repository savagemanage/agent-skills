// actionlog.mjs — pure accumulator for the structured action log of a run.
//
// It records one entry per scenario step plus page-level console errors and
// failed network responses (HTTP >= 400), keyed to whichever step was
// executing when they occurred. Serializes to a stable JSON shape consumed by
// the review workflow (later feature).

export class ActionLog {
  constructor(meta = {}) {
    this.meta = {
      runId: meta.runId ?? null,
      configName: meta.configName ?? null,
      baseUrl: meta.baseUrl ?? null,
      startedAt: meta.startedAt ?? new Date().toISOString(),
      finishedAt: null,
      ...meta,
    };
    this.steps = [];
    this.consoleErrors = [];
    this.networkErrors = [];
    this._current = null; // index of the step currently executing
  }

  /**
   * Begin a step. Returns a handle object used to finish it.
   */
  startStep(action, args = {}) {
    const index = this.steps.length;
    const record = {
      index,
      action,
      args,
      status: 'pass',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      detail: null,
      screenshot: null,
      snapshot: null,
      _start: Date.now(),
    };
    this.steps.push(record);
    this._current = index;
    return record;
  }

  /**
   * Finish a step, setting status ('pass'|'fail'|'error'), an optional detail
   * message, and optional artifact paths.
   */
  finishStep(record, { status = 'pass', detail = null, screenshot = null, snapshot = null } = {}) {
    record.status = status;
    record.detail = detail;
    if (screenshot != null) record.screenshot = screenshot;
    if (snapshot != null) record.snapshot = snapshot;
    record.durationMs = Date.now() - record._start;
    delete record._start;
  }

  /** Record a console error, keyed to the current step index (or null). */
  addConsoleError(text) {
    this.consoleErrors.push({ stepIndex: this._current, text: String(text), at: new Date().toISOString() });
  }

  /** Record a failed network response (status >= 400), keyed to current step. */
  addNetworkError({ url, status, method }) {
    this.networkErrors.push({
      stepIndex: this._current,
      url: String(url),
      status: Number(status),
      method: method ? String(method) : null,
      at: new Date().toISOString(),
    });
  }

  /** Counts of pass/fail/error steps. */
  summary() {
    const counts = { pass: 0, fail: 0, error: 0 };
    for (const s of this.steps) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return {
      total: this.steps.length,
      ...counts,
      consoleErrors: this.consoleErrors.length,
      networkErrors: this.networkErrors.length,
      ok: counts.fail === 0 && counts.error === 0,
    };
  }

  /** Serialize to a plain JSON-ready object. */
  toJSON() {
    this.meta.finishedAt = this.meta.finishedAt ?? new Date().toISOString();
    return {
      meta: this.meta,
      summary: this.summary(),
      steps: this.steps.map(({ _start, ...rest }) => rest),
      consoleErrors: this.consoleErrors,
      networkErrors: this.networkErrors,
    };
  }

  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}
