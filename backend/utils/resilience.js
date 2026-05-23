/**
 * Small, dependency-free resilience primitives for guarding calls to flaky
 * external services. Used to wrap the Gemini API, but intentionally generic.
 */

/** Error thrown when the circuit is open (fail-fast, no downstream call made). */
export class CircuitOpenError extends Error {
  constructor(message = 'Circuit is open') {
    super(message);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
  }
}

/**
 * Reject a promise if it does not settle within `ms`. The timeout error is
 * tagged `transient` so the retry layer treats it as retryable.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Request timed out after ${ms}ms`);
      err.transient = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Decide whether an error is worth retrying. Transient = network blips,
 * timeouts, and 5xx responses. Client errors (4xx) and malformed-output
 * errors are NOT retried — retrying can't fix them.
 */
export function isTransientError(err) {
  if (err?.transient) return true;
  const status = err?.status ?? err?.response?.status ?? err?.code;
  if (typeof status === 'number') return status >= 500;
  const msg = String(err?.message || '');
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(msg);
}

/**
 * Retry `fn` with exponential backoff, but only for transient errors.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, baseDelayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function retry(fn, { attempts = 3, baseDelayMs = 300 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastErr;
}

/**
 * Minimal in-memory circuit breaker (CLOSED → OPEN → HALF_OPEN).
 *
 * After `failureThreshold` consecutive failures the breaker OPENs and fails
 * fast for `cooldownMs`, so a downstream outage doesn't pile up hundreds of
 * hanging requests. After the cooldown it goes HALF_OPEN and lets a single
 * trial request through: success closes the circuit, failure re-opens it.
 *
 * In-memory means the state is per-process — acceptable here because the
 * breaker's job is local fail-fast, not cluster-wide coordination.
 */
export class CircuitBreaker {
  constructor({ failureThreshold = 5, cooldownMs = 30_000, name = 'circuit' } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.name = name;
    this.state = 'CLOSED';
    this.failures = 0;
    this.openedAt = 0;
  }

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async exec(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt < this.cooldownMs) {
        throw new CircuitOpenError(`${this.name} is temporarily unavailable`);
      }
      this.state = 'HALF_OPEN'; // allow one trial request through
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  _onFailure() {
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
