/**
 * Voice of Kannada - Gemini AI Resilience & Configuration
 * Provides automatic retry on 503/429 with backoff and graceful fallback to secondary models.
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

/**
 * Determines whether a Gemini API error is a transient 503 (high demand/overloaded) or 429 (rate limited).
 */
export function isRetryableGeminiError(err: unknown): boolean {
  if (!err) return false;

  const anyErr = err as Record<string, unknown>;
  const status = Number(anyErr.status || anyErr.statusCode || anyErr.code);
  if (status === 503 || status === 429) {
    return true;
  }
  if (anyErr.status === "UNAVAILABLE" || anyErr.status === "RESOURCE_EXHAUSTED") {
    return true;
  }

  const message = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(message);
    const code = Number(parsed?.error?.code);
    const statusStr = String(parsed?.error?.status || "");
    const msg = String(parsed?.error?.message || "").toLowerCase();

    if (code === 503 || code === 429) return true;
    if (statusStr === "UNAVAILABLE" || statusStr === "RESOURCE_EXHAUSTED") return true;
    if (
      msg.includes("503") ||
      msg.includes("429") ||
      msg.includes("high demand") ||
      msg.includes("overloaded") ||
      msg.includes("busy") ||
      msg.includes("resource has been exhausted") ||
      msg.includes("too many requests") ||
      msg.includes("rate limit") ||
      msg.includes("temporarily unavailable")
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
    lower.includes("high demand") ||
    lower.includes("unavailable") ||
    lower.includes("resource_exhausted") ||
    lower.includes("overloaded") ||
    lower.includes("too many requests") ||
    lower.includes("temporarily unavailable")
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
  operation: (model: string) => Promise<T>;
  delays?: number[];
  onRetry?: (model: string, attempt: number, delayMs: number, error: unknown) => void;
  onFallback?: (primaryModel: string, fallbackModel: string, error: unknown) => void;
}

/**
 * Executes a Gemini operation with resilience:
 * 1. On 503 or 429, retry up to 2 times with a short delay (1s, then 2s).
 * 2. If it still fails, fall back to the secondary model (with the same retry resilience).
 * 3. If all attempts fail, throws an error with `isBusy: true`.
 */
export async function executeWithRetryAndFallback<T>({
  primaryModel,
  fallbackModel,
  operation,
  delays = [1000, 2000],
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

    if (isFallback) {
      if (onFallback) {
        onFallback(primaryModel, currentModel, lastError);
      } else {
        console.warn(
          `[Gemini Resilience] Primary model [${primaryModel}] exhausted retries or failed. Falling back to [${currentModel}]...`
        );
      }
    }

    // Try current model: initial try + up to delays.length retries (2 retries: 1s, 2s)
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const data = await operation(currentModel);
        return { data, modelUsed: currentModel };
      } catch (err: unknown) {
        lastError = err;
        const retryable = isRetryableGeminiError(err);
        lastWasRetryable = retryable;

        const isModelNotFound =
          String(err).includes("404") ||
          (err as Record<string, unknown>)?.status === 404 ||
          (err as Record<string, unknown>)?.statusCode === 404;

        console.error(
          `[Gemini Resilience] Model [${currentModel}] attempt ${attempt + 1}/${delays.length + 1} failed (retryable: ${retryable}):`,
          extractGeminiErrorMessage(err)
        );

        // If not retryable (e.g. 401 unauthenticated, 400 bad request),
        // don't waste time retrying unless model was not found and we can fallback.
        if (!retryable && !isModelNotFound) {
          throw err;
        }

        // If retryable (503/429) and attempts remain for this model:
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
