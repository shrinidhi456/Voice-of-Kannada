import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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
    const {
      targetPhrase,
      romanization,
      spokenTranscript,
    }: {
      targetPhrase?: string;
      romanization?: string;
      spokenTranscript?: string;
    } = await req.json();

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

    const promptText = `
You are an encouraging, expert Kannada language and pronunciation tutor helping non-Kannada speakers improve their spoken Kannada.

Target Phrase: "${targetPhrase}"
Romanization: "${romanization || ""}"
Learner's Spoken Transcript: "${spokenTranscript}"

Analyze the pronunciation difference. Specifically look out for common Kannada learner mistakes:
1. Retroflex vs dental consonants (e.g. 'ಳ' vs 'ಲ', 'ಣ' vs 'ನ', 'ಟ/ಡ' vs 'ತ/ದ').
2. Aspirated vs unaspirated sounds (e.g. 'ಕ' vs 'ಖ', 'ಪ' vs 'ಫ', 'ದ' vs 'ಧ').
3. Short vs long vowels (e.g. 'ಅ' vs 'ಆ', 'ಇ' vs 'ಈ', 'ಒ' vs 'ಓ', 'ಎ' vs 'ಏ').
4. Word endings and vowel elongation.

Instruction:
Provide ONE concise, practical, and friendly English tip (1 to 2 sentences) explaining the likely sound difference and how to position their tongue/mouth to say it accurately.

You MUST reply ONLY with a single JSON object in this exact format:
{
  "tip": "<One short, friendly English tip about the specific sound mistake and how to fix it>"
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
      tip:
        parsed.tip ||
        "Good effort! Pay attention to the vowel length and roll your tongue slightly for retroflex sounds.",
      model: GEMINI_MODEL,
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
