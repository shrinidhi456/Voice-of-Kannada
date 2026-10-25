/**
 * Voice of Kannada - Gemini AI Resilience & Configuration
 * Provides automatic retry with backoff, per-attempt timeout, and graceful fallback to secondary models.
 */

// Official Gemini models from Google AI documentation: https://ai.google.dev/gemini-api/docs/models/gemini
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_FALLBACK_MODEL;

// Official Gemini TTS models
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
export const DEFAULT_GEMINI_TTS_FALLBACK_MODEL = "gemini-3.8-flash-lite-tts";

export const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL;
export const GEMINI_TTS_FALLBACK_MODEL =
  process.env.GEMINI_TTS_FALLBACK_MODEL ||
  process.env.GEMINI_FALLBACK_MODEL ||
  DEFAULT_GEMINI_TTS_FALLBACK_MODEL;

// Timeout and Retry resilience configurations
export const DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS = 8000; // 8 seconds per attempt
export const GEMINI_ATTEMPT_TIMEOUT_MS = process.env.GEMINI_ATTEMPT_TIMEOUT_MS
  ? Number(process.env.GEMINI_ATTEMPT_TIMEOUT_MS)
  : DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS;

export const DEFAULT_GEMINI_RETRY_DELAYS = [500, 500]; // 0.5s retry delays

/**
 * Determines whether an error is a timeout error.
 */
export function isTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as Record<string, unknown>;
  if (anyErr.isTimeout === true || anyErr.name === "TimeoutError" || anyErr.code === "ETIMEDOUT") {
    return true;
  }
  const status = Number(anyErr.status || anyErr.statusCode);
  if (status === 504) return true;
  if (anyErr.status === "DEADLINE_EXCEEDED") return true;

  const message = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(message);
    const code = Number(parsed?.error?.code);
    const statusStr = String(parsed?.error?.status || "");
    const msg = String(parsed?.error?.message || "").toLowerCase();
    if (code === 504 || statusStr === "DEADLINE_EXCEEDED") return true;
    if (msg.includes("timed out") || msg.includes("timeout") || msg.includes("deadline exceeded")) {
      return true;
    }
  } catch {
    // Non-JSON message string
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("etimedout") ||
    lower.includes("deadline exceeded")
  );
}

/**
 * Determines whether an error is a 503 (service unavailable / high demand / overloaded).
 */
export function is503Error(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as Record<string, unknown>;
  const status = Number(anyErr.status || anyErr.statusCode || anyErr.code);
  if (status === 503 || anyErr.status === "UNAVAILABLE") {
    return true;
  }

  const message = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(message);
    const code = Number(parsed?.error?.code);
    const statusStr = String(parsed?.error?.status || "");
    const msg = String(parsed?.error?.message || "").toLowerCase();
    if (code === 503 || statusStr === "UNAVAILABLE") return true;
    if (
      msg.includes("503") ||
      msg.includes("unavailable") ||
      msg.includes("high demand") ||
      msg.includes("overloaded") ||
      msg.includes("busy")
    ) {
      return true;
    }
  } catch {
    // Non-JSON message string
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("high demand") ||
    lower.includes("overloaded")
  );
}

/**
 * Determines whether a Gemini API error is a transient 503 (high demand/overloaded), 429 (rate limited), or timeout.
 */
export function isRetryableGeminiError(err: unknown): boolean {
  if (!err) return false;

  if (isTimeoutError(err) || is503Error(err)) {
    return true;
  }

  const anyErr = err as Record<string, unknown>;
  const status = Number(anyErr.status || anyErr.statusCode || anyErr.code);
  if (status === 503 || status === 429 || status === 504) {
    return true;
  }
  if (
    anyErr.status === "UNAVAILABLE" ||
    anyErr.status === "RESOURCE_EXHAUSTED" ||
    anyErr.status === "DEADLINE_EXCEEDED"
  ) {
    return true;
  }

  const message = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(message);
    const code = Number(parsed?.error?.code);
    const statusStr = String(parsed?.error?.status || "");
    const msg = String(parsed?.error?.message || "").toLowerCase();

    if (code === 503 || code === 429 || code === 504) return true;
    if (
      statusStr === "UNAVAILABLE" ||
      statusStr === "RESOURCE_EXHAUSTED" ||
      statusStr === "DEADLINE_EXCEEDED"
    ) {
      return true;
    }
    if (
      msg.includes("503") ||
      msg.includes("429") ||
      msg.includes("504") ||
      msg.includes("high demand") ||
      msg.includes("overloaded") ||
      msg.includes("busy") ||
      msg.includes("resource has been exhausted") ||
      msg.includes("too many requests") ||
      msg.includes("rate limit") ||
      msg.includes("temporarily unavailable") ||
      msg.includes("timed out") ||
      msg.includes("timeout") ||
      msg.includes("deadline exceeded")
    ) {
      return true;
    }
  } catch {
    // Non-JSON message string
  }

  const lower = message.toLowerCase();
  if (
    lower.includes("503") ||
    lower.includes("429") ||
    lower.includes("504") ||
    lower.includes("high demand") ||
    lower.includes("unavailable") ||
    lower.includes("resource_exhausted") ||
    lower.includes("overloaded") ||
    lower.includes("too many requests") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("deadline exceeded")
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts a clean, human-readable error string from various Gemini error formats.
 */
export function extractGeminiErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const anyErr = err as Record<string, unknown>;
  const message = err instanceof Error ? err.message : String(err);

  try {
    const parsed = JSON.parse(message);
    if (parsed?.error) {
      const code = parsed.error.code;
      const msg = parsed.error.message || "";
      const statusStr = parsed.error.status || "";
      return `${msg} (${code || statusStr})`;
    }
  } catch {
    // ignore
  }

  return anyErr.message ? String(anyErr.message) : message;
}

export interface RetryOptions<T> {
  primaryModel: string;
  fallbackModel: string;
  operation: (model: string, signal?: AbortSignal) => Promise<T>;
  delays?: number[];
  attemptTimeoutMs?: number;
  onRetry?: (model: string, attempt: number, delayMs: number, error: unknown) => void;
  onFallback?: (primaryModel: string, fallbackModel: string, error: unknown) => void;
}

/**
 * Executes a Gemini operation with resilience:
 * 1. Each Gemini attempt has a timeout of 8 seconds (configurable via attemptTimeoutMs).
 * 2. On timeout or 503, switches straight to the fallback model instead of waiting.
 * 3. Reduces retry delays to 0.5 seconds for retryable transient errors (e.g. 429).
 * 4. If all attempts fail, throws a friendly error with `isBusy: true`.
 */
export async function executeWithRetryAndFallback<T>({
  primaryModel,
  fallbackModel,
  operation,
  delays = DEFAULT_GEMINI_RETRY_DELAYS,
  attemptTimeoutMs = GEMINI_ATTEMPT_TIMEOUT_MS,
  onRetry,
  onFallback,
}: RetryOptions<T>): Promise<{ data: T; modelUsed: string }> {
  const models = [
    { name: primaryModel, isFallback: false },
    ...(fallbackModel && fallbackModel !== primaryModel ? [{ name: fallbackModel, isFallback: true }] : []),
  ];

  let lastError: unknown = null;
  let lastWasRetryable = false;

  for (let mIdx = 0; mIdx < models.length; mIdx++) {
    const { name: currentModel, isFallback } = models[mIdx];
    const hasNextFallback = mIdx < models.length - 1;

    if (isFallback) {
      if (onFallback) {
        onFallback(primaryModel, currentModel, lastError);
      } else {
        console.warn(
          `[Gemini Resilience] Primary model [${primaryModel}] exhausted retries, timed out, or returned 503. Falling back to [${currentModel}]...`
        );
      }
    }

    // Try current model: initial try + up to delays.length retries (0.5s default delay)
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      let timer: NodeJS.Timeout | null = null;
      const controller = new AbortController();

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            const timeoutErr = new Error(
              `Gemini attempt timed out after ${attemptTimeoutMs}ms for model [${currentModel}]`
            );
            const timeoutErrObj = timeoutErr as unknown as Record<string, unknown>;
            timeoutErrObj.name = "TimeoutError";
            timeoutErrObj.isTimeout = true;
            timeoutErrObj.code = "ETIMEDOUT";
            timeoutErrObj.status = 504;
            reject(timeoutErr);
          }, attemptTimeoutMs);
        });

        const data = await Promise.race([
          operation(currentModel, controller.signal),
          timeoutPromise,
        ]);
        return { data, modelUsed: currentModel };
      } catch (err: unknown) {
        lastError = err;
        const isTimeout = isTimeoutError(err);
        const is503 = is503Error(err);
        const retryable = isRetryableGeminiError(err) || isTimeout;
        lastWasRetryable = retryable;

        const isModelNotFound =
          String(err).includes("404") ||
          (err as Record<string, unknown>)?.status === 404 ||
          (err as Record<string, unknown>)?.statusCode === 404;

        console.error(
          `[Gemini Resilience] Model [${currentModel}] attempt ${attempt + 1}/${delays.length + 1} failed (timeout: ${isTimeout}, 503: ${is503}, retryable: ${retryable}):`,
          extractGeminiErrorMessage(err)
        );

        // If not retryable (e.g. 401 unauthenticated, 400 bad request),
        // don't waste time retrying unless model was not found and we can fallback.
        if (!retryable && !isModelNotFound) {
          throw err;
        }

        // On timeout or 503: switch straight to the fallback model instead of waiting
        if ((isTimeout || is503) && hasNextFallback) {
          console.warn(
            `[Gemini Resilience] Model [${currentModel}] ${isTimeout ? "timed out" : "returned 503"}. Switching straight to fallback model [${models[mIdx + 1].name}] without waiting...`
          );
          break; // Switch straight to the next (fallback) model!
        }

        // If retryable (e.g. 429) and attempts remain for this model:
        if (retryable && attempt < delays.length) {
          const delayMs = delays[attempt];
          if (onRetry) {
            onRetry(currentModel, attempt + 1, delayMs, err);
          } else {
            console.warn(
              `[Gemini Resilience] Retrying model [${currentModel}] in ${delayMs}ms (attempt ${attempt + 1}/${delays.length})...`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // Exhausted retries for this model or 404 -> proceed to fallback model
        break;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }
  }

  // If we reach this point, all retries on all models failed
  const finalError = new Error("The AI is busy, please try again in a few seconds");
  (finalError as unknown as Record<string, unknown>).isBusy = lastWasRetryable;
  (finalError as unknown as Record<string, unknown>).originalError = lastError;
  (finalError as unknown as Record<string, unknown>).lastModel = models[models.length - 1]?.name;
  throw finalError;
}
