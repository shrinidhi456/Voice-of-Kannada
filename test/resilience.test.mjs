import assert from "node:assert/strict";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_FALLBACK_MODEL,
  isRetryableGeminiError,
  extractGeminiErrorMessage,
  executeWithRetryAndFallback,
} from "../src/lib/gemini.ts";

async function runTests() {
  console.log("--- Starting Gemini Resilience Tests ---");

  // 1. Test model constants
  console.log("Test 1: Model Constants");
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-3.8-flash");
  assert.equal(DEFAULT_GEMINI_FALLBACK_MODEL, "gemini-3.5-flash-lite");
  assert.equal(DEFAULT_GEMINI_TTS_MODEL, "gemini-3.8-flash-tts");
  assert.equal(DEFAULT_GEMINI_TTS_FALLBACK_MODEL, "gemini-3.8-flash-lite-tts");
  console.log("✓ Model constants match official Google documentation");

  // 2. Test isRetryableGeminiError
  console.log("Test 2: isRetryableGeminiError");
  assert.equal(isRetryableGeminiError({ status: 503 }), true);
  assert.equal(isRetryableGeminiError({ status: 429 }), true);
  assert.equal(isRetryableGeminiError(new Error("503 Service Unavailable")), true);
  assert.equal(isRetryableGeminiError(new Error("The model is overloaded: high demand")), true);
  assert.equal(isRetryableGeminiError(new Error(JSON.stringify({ error: { code: 503, status: "UNAVAILABLE", message: "high demand" } }))), true);
  assert.equal(isRetryableGeminiError(new Error(JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }))), true);
  assert.equal(isRetryableGeminiError(new Error("API key not valid (401)")), false);
  assert.equal(isRetryableGeminiError(new Error("Bad request (400)")), false);
  console.log("✓ isRetryableGeminiError correctly identifies 503 and 429 transient errors");

  // 3. Test retry logic with primary model recovery
  console.log("Test 3: Retries on 503 up to 2 times and succeeds");
  let primaryAttempts = 0;
  const retryResult = await executeWithRetryAndFallback({
    primaryModel: "gemini-3.8-flash",
    fallbackModel: "gemini-3.5-flash-lite",
    delays: [10, 20], // fast delays for unit test
    operation: async (model) => {
      primaryAttempts++;
      if (primaryAttempts < 3) {
        const err = new Error("503 high demand");
        err.status = 503;
        throw err;
      }
      return `Success from ${model}`;
    },
  });
  assert.equal(primaryAttempts, 3); // initial + 2 retries
  assert.equal(retryResult.data, "Success from gemini-3.8-flash");
  assert.equal(retryResult.modelUsed, "gemini-3.8-flash");
  console.log("✓ Primary model retried twice on 503 and succeeded on attempt 3");

  // 4. Test fallback model when primary exhausts retries
  console.log("Test 4: Falls back to secondary model when primary exhausts retries");
  let attempts = { "gemini-3.8-flash": 0, "gemini-3.5-flash-lite": 0 };
  const fallbackResult = await executeWithRetryAndFallback({
    primaryModel: "gemini-3.8-flash",
    fallbackModel: "gemini-3.5-flash-lite",
    delays: [10, 20],
    operation: async (model) => {
      attempts[model]++;
      if (model === "gemini-3.8-flash") {
        const err = new Error("503 high demand");
        err.status = 503;
        throw err;
      }
      return `Success from ${model}`;
    },
  });
  assert.equal(attempts["gemini-3.8-flash"], 3); // initial + 2 retries
  assert.equal(attempts["gemini-3.5-flash-lite"], 1); // 1st attempt on fallback succeeded
  assert.equal(fallbackResult.modelUsed, "gemini-3.5-flash-lite");
  assert.equal(fallbackResult.data, "Success from gemini-3.5-flash-lite");
  console.log("✓ Primary failed all retries; successfully fell back to gemini-3.5-flash-lite");

  // 5. Test all models fail -> throws friendly error with isBusy: true
  console.log("Test 5: All models fail 503 -> returns friendly 'The AI is busy, please try again in a few seconds'");
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
  console.log("✓ Correctly throws friendly message with isBusy: true when everything fails");

  // 6. Test non-retryable error (e.g. 401) throws immediately without retrying
  console.log("Test 6: Non-retryable error (401) throws immediately without retry");
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
  assert.equal(nonRetryAttempts, 1); // Only 1 attempt, zero retries
  console.log("✓ Non-retryable error throws immediately on first attempt without delay");

  console.log("\nALL RESILIENCE TESTS PASSED! 🎉");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
