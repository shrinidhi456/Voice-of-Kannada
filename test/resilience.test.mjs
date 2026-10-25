import assert from "node:assert/strict";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_FALLBACK_MODEL,
  DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS,
  DEFAULT_GEMINI_RETRY_DELAYS,
  isRetryableGeminiError,
  is503Error,
  isTimeoutError,
  extractGeminiErrorMessage,
  executeWithRetryAndFallback,
} from "../src/lib/gemini.ts";

async function runTests() {
  console.log("--- Starting Gemini Resilience Tests ---");

  // 1. Test model constants and resilience configuration defaults
  console.log("Test 1: Model Constants and Configuration Defaults");
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-3.8-flash");
  assert.equal(DEFAULT_GEMINI_FALLBACK_MODEL, "gemini-3.5-flash-lite");
  assert.equal(DEFAULT_GEMINI_TTS_MODEL, "gemini-3.8-flash-tts");
  assert.equal(DEFAULT_GEMINI_TTS_FALLBACK_MODEL, "gemini-3.8-flash-lite-tts");
  assert.equal(DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS, 8000, "Attempt timeout must default to 8000ms (8 seconds)");
  assert.deepEqual(DEFAULT_GEMINI_RETRY_DELAYS, [500, 500], "Retry delays must be 0.5 seconds (500ms)");
  console.log("✓ Model constants and defaults match official Google models list and speed requirements");

  // 2. Test isRetryableGeminiError, is503Error, and isTimeoutError
  console.log("Test 2: Error Classification (503, 429, Timeout, 401)");
  assert.equal(is503Error({ status: 503 }), true);
  assert.equal(is503Error({ status: 429 }), false);
  assert.equal(is503Error(new Error("503 Service Unavailable")), true);
  assert.equal(is503Error(new Error("The model is overloaded: high demand")), true);

  assert.equal(isTimeoutError({ isTimeout: true }), true);
  assert.equal(isTimeoutError({ name: "TimeoutError" }), true);
  assert.equal(isTimeoutError({ code: "ETIMEDOUT" }), true);
  assert.equal(isTimeoutError(new Error("Gemini attempt timed out after 8000ms")), true);
  assert.equal(isTimeoutError({ status: 503 }), false);

  assert.equal(isRetryableGeminiError({ status: 503 }), true);
  assert.equal(isRetryableGeminiError({ status: 429 }), true);
  assert.equal(isRetryableGeminiError({ isTimeout: true }), true);
  assert.equal(isRetryableGeminiError(new Error("timed out")), true);
  assert.equal(isRetryableGeminiError(new Error("API key not valid (401)")), false);
  assert.equal(isRetryableGeminiError(new Error("Bad request (400)")), false);

  assert.equal(extractGeminiErrorMessage(new Error("Test error message")), "Test error message");
  assert.equal(
    extractGeminiErrorMessage(new Error(JSON.stringify({ error: { code: 503, message: "Overloaded" } }))),
    "Overloaded (503)"
  );
  console.log("✓ Error classification correctly categorizes 503, timeout, and 429");

  // 3. Test 429 retry logic: retries with short delays and recovers
  console.log("Test 3: Retries on 429 rate-limit with retry delays and succeeds");
  let primary429Attempts = 0;
  const retryResult = await executeWithRetryAndFallback({
    primaryModel: "gemini-3.8-flash",
    fallbackModel: "gemini-3.5-flash-lite",
    delays: [10, 20], // fast test delays
    operation: async (model) => {
      primary429Attempts++;
      if (primary429Attempts < 3) {
        const err = new Error("429 Too Many Requests");
        err.status = 429;
        throw err;
      }
      return `Success from ${model}`;
    },
  });
  assert.equal(primary429Attempts, 3); // initial + 2 retries
  assert.equal(retryResult.data, "Success from gemini-3.8-flash");
  assert.equal(retryResult.modelUsed, "gemini-3.8-flash");
  console.log("✓ Primary model retried twice on 429 and succeeded on attempt 3");

  // 4. Test on 503: switch straight to fallback model without waiting or retrying primary
  console.log("Test 4: On 503 switches straight to fallback model without waiting");
  const attempts503 = { "gemini-3.8-flash": 0, "gemini-3.5-flash-lite": 0 };
  const fallback503Result = await executeWithRetryAndFallback({
    primaryModel: "gemini-3.8-flash",
    fallbackModel: "gemini-3.5-flash-lite",
    delays: [50, 100],
    operation: async (model) => {
      attempts503[model]++;
      if (model === "gemini-3.8-flash") {
        const err = new Error("503 Service Unavailable (high demand)");
        err.status = 503;
        throw err;
      }
      return `Success from ${model}`;
    },
  });
  // Primary should have only 1 attempt (NO waiting, NO retrying on 503)
  assert.equal(attempts503["gemini-3.8-flash"], 1, "Primary model must not retry on 503; must switch straight to fallback");
  assert.equal(attempts503["gemini-3.5-flash-lite"], 1, "Fallback model must execute immediately on 1st attempt");
  assert.equal(fallback503Result.modelUsed, "gemini-3.5-flash-lite");
  assert.equal(fallback503Result.data, "Success from gemini-3.5-flash-lite");
  console.log("✓ On 503, switched immediately to gemini-3.5-flash-lite on attempt 1 without waiting");

  // 5. Test on timeout: switch straight to fallback model without waiting
  console.log("Test 5: On timeout switches straight to fallback model without waiting");
  const attemptsTimeout = { "gemini-3.8-flash": 0, "gemini-3.5-flash-lite": 0 };
  const fallbackTimeoutResult = await executeWithRetryAndFallback({
    primaryModel: "gemini-3.8-flash",
    fallbackModel: "gemini-3.5-flash-lite",
    delays: [50, 100],
    operation: async (model) => {
      attemptsTimeout[model]++;
      if (model === "gemini-3.8-flash") {
        const err = new Error("Gemini attempt timed out after 8000ms");
        err.isTimeout = true;
        err.status = 504;
        throw err;
      }
      return `Success from ${model}`;
    },
  });
  assert.equal(attemptsTimeout["gemini-3.8-flash"], 1, "Primary model must not retry on timeout; must switch straight to fallback");
  assert.equal(attemptsTimeout["gemini-3.5-flash-lite"], 1);
  assert.equal(fallbackTimeoutResult.modelUsed, "gemini-3.5-flash-lite");
  console.log("✓ On timeout, switched immediately to gemini-3.5-flash-lite on attempt 1 without waiting");

  // 6. Test per-attempt timeout execution
  console.log("Test 6: Attempt times out if operation exceeds attemptTimeoutMs");
  const attemptsPerAttempt = { "gemini-3.8-flash": 0, "gemini-3.5-flash-lite": 0 };
  const start = Date.now();
  const perAttemptResult = await executeWithRetryAndFallback({
    primaryModel: "gemini-3.8-flash",
    fallbackModel: "gemini-3.5-flash-lite",
    attemptTimeoutMs: 100, // fast timeout for test (100ms)
    delays: [20, 20],
    operation: async (model) => {
      attemptsPerAttempt[model]++;
      if (model === "gemini-3.8-flash") {
        // Hang longer than 100ms
        await new Promise((resolve) => setTimeout(resolve, 600));
        return "Slow primary";
      }
      return `Fast fallback from ${model}`;
    },
  });
  const elapsed = Date.now() - start;
  assert.equal(attemptsPerAttempt["gemini-3.8-flash"], 1);
  assert.equal(attemptsPerAttempt["gemini-3.5-flash-lite"], 1);
  assert.equal(perAttemptResult.modelUsed, "gemini-3.5-flash-lite");
  assert.equal(perAttemptResult.data, "Fast fallback from gemini-3.5-flash-lite");
  assert.ok(elapsed < 400, `Execution should finish quickly (~100-200ms), took ${elapsed}ms`);
  console.log(`✓ Attempt timed out at 100ms and switched straight to fallback (completed in ${elapsed}ms)`);

  // 7. Test all models fail 503 -> throws friendly error with isBusy: true
  console.log("Test 7: All models fail 503 -> returns friendly 'The AI is busy, please try again in a few seconds'");
  let threwExpected = false;
  try {
    await executeWithRetryAndFallback({
      primaryModel: "gemini-3.8-flash",
      fallbackModel: "gemini-3.5-flash-lite",
      delays: [10, 20],
      operation: async () => {
        const err = new Error("503 Service Unavailable (high demand)");
        err.status = 503;
        throw err;
      },
    });
  } catch (err) {
    threwExpected = true;
    assert.equal(err.message, "The AI is busy, please try again in a few seconds");
    assert.equal(err.isBusy, true);
  }
  assert.equal(threwExpected, true);
  console.log("✓ Correctly throws friendly message with isBusy: true when all models fail");

  // 8. Test non-retryable error (e.g. 401) throws immediately without retrying or fallback
  console.log("Test 8: Non-retryable error (401) throws immediately without retry or fallback");
  let nonRetryAttempts = 0;
  let nonRetryThrew = false;
  try {
    await executeWithRetryAndFallback({
      primaryModel: "gemini-3.8-flash",
      fallbackModel: "gemini-3.5-flash-lite",
      delays: [10, 20],
      operation: async () => {
        nonRetryAttempts++;
        const err = new Error("API key not valid (401)");
        err.status = 401;
        throw err;
      },
    });
  } catch (err) {
    nonRetryThrew = true;
    assert.equal(err.status, 401);
  }
  assert.equal(nonRetryThrew, true);
  assert.equal(nonRetryAttempts, 1); // Only 1 attempt, zero retries, no fallback
  console.log("✓ Non-retryable error throws immediately on first attempt without delay or fallback");

  console.log("\nALL RESILIENCE TESTS PASSED! 🎉");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
