import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { calculatePronunciationScore } from "@/lib/pronunciation";
import { checkRateLimit, validateRequestBody } from "@/lib/rateLimit";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

function extractJson(raw: string) {
  let clean = raw.trim();
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
  }

  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.substring(start, end + 1);
  }

  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting: at most 20 requests per minute per IP address
    const rateLimit = checkRateLimit(req);
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response;
    }

    // 2. Reject request bodies larger than 20 KB
    const bodyResult = await validateRequestBody<{
      targetPhrase?: string;
      romanization?: string;
      spokenTranscript?: string;
      score?: number;
    }>(req);
    if (bodyResult.response) {
      return bodyResult.response;
    }

    const {
      targetPhrase,
      romanization,
      spokenTranscript,
      score: incomingScore,
    } = bodyResult.data || {};

    if (!targetPhrase || !spokenTranscript) {
      return NextResponse.json(
        { error: "Target phrase and spoken transcript are required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured on the server. Please add your key in .env.local to receive pronunciation tips.",
        },
        { status: 401 }
      );
    }

    // Determine accuracy score (use provided score or calculate via Levenshtein)
    const score =
      typeof incomingScore === "number"
        ? incomingScore
        : calculatePronunciationScore(targetPhrase, spokenTranscript).score;

    const promptText = `
You are an expert Kannada pronunciation tutor. Analyze the learner's spoken attempt against the target Kannada phrase.

Target Phrase: "${targetPhrase}"
Target Romanization: "${romanization || ""}"
Learner Spoke: "${spokenTranscript}"
Calculated Match Score: ${score}/100

STRICT RULES FOR YOUR TIP:
1. Length: Exactly 1 to 2 short sentences.
2. If the score is 90 or above (or practically perfect): Reply with a brief praise only (e.g. "Excellent pronunciation! That was clear and natural.").
3. Focus ONLY on the specific words that were mismatched or missing.
4. Different word vs Sound mistake:
   - If the learner spoke a completely different word (e.g., said 'ಚಹಾ' instead of 'ಕಾಫಿ', or 'ದೋಸೆ' instead of 'ಇಡ್ಲಿ'): DO NOT give tongue or mouth advice. Simply state which word was said instead of which, and give its English meaning (e.g., "You said '...' (meaning ...) instead of '...'.").
   - Only give mouth, tongue, or sound advice (retroflex ಳ/ಲ, aspirated ಕ/ಖ, short/long vowels) if the mismatched word is a close/near-match with a genuine phonetic sound difference. Do NOT give generic mouth advice.

Reply ONLY in this JSON format:
{
  "tip": "<Your 1-2 sentence tip adhering strictly to the above rules>"
}
`;

    const ai = new GoogleGenAI({ apiKey });

    let rawText = "";
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptText,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        rawText = response.text;
      }
    } catch (err: unknown) {
      console.error(`Gemini feedback error with model [${GEMINI_MODEL}]:`, err);
      let errorMsg = err instanceof Error ? err.message : String(err);
      let status = 502;

      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed?.error) {
          const code = parsed.error.code;
          const msg = parsed.error.message || "";
          const statusStr = parsed.error.status || "";
          errorMsg = `${msg} (${code || statusStr})`;
        }
      } catch {
        // ignore
      }

      return NextResponse.json(
        {
          error: `Gemini Feedback Error [${GEMINI_MODEL}]: ${errorMsg}`,
          model: GEMINI_MODEL,
        },
        { status }
      );
    }

    let parsed: { tip?: string };
    try {
      parsed = extractJson(rawText);
    } catch {
      return NextResponse.json(
        {
          error: "Failed to parse pronunciation tip response from AI.",
          raw: rawText,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tip: parsed.tip || (score >= 90 ? "Great job! Accurate and natural pronunciation." : "Keep practicing!"),
      model: GEMINI_MODEL,
      score,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected server error occurred.";
    return NextResponse.json(
      {
        error: `Server feedback error: ${message}`,
      },
      { status: 500 }
    );
  }
}
