import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, validateRequestBody } from "@/lib/rateLimit";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS,
  DEFAULT_GEMINI_RETRY_DELAYS,
  executeWithRetryAndFallback,
  isRetryableGeminiError,
  extractGeminiErrorMessage,
} from "@/lib/gemini";

// Re-export constants for external consumers & testing
export {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS,
  DEFAULT_GEMINI_RETRY_DELAYS,
};

interface ChatMessage {
  sender: "user" | "ai";
  kannada?: string;
  romanization?: string;
  english?: string;
  text?: string;
}

function extractJson(raw: string) {
  let clean = raw.trim();
  // Strip markdown code fences if present
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
  }

  // Find boundaries of the JSON object
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
      role?: string;
      systemPrompt?: string;
      history?: ChatMessage[];
      userMessage?: string;
    }>(req);
    if (bodyResult.response) {
      return bodyResult.response;
    }

    const {
      role,
      systemPrompt,
      history = [],
      userMessage,
    } = bodyResult.data || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured on the server. Please add your Gemini API key to .env.local to chat with the AI.",
        },
        { status: 401 }
      );
    }

    if (!userMessage || !userMessage.trim()) {
      return NextResponse.json(
        { error: "Please provide a valid message to speak with the character." },
        { status: 400 }
      );
    }

    // Format conversation history for context
    const formattedHistory = history
      .slice(-8) // keep recent turns
      .map((msg) => {
        if (msg.sender === "user") {
          return `User: ${msg.text || msg.kannada || ""}`;
        } else {
          return `Character: ${msg.kannada} (${msg.romanization || ""})`;
        }
      })
      .join("\n");

    const promptText = `
Role: ${role || "A friendly local in Bengaluru speaking Kannada"}
Scenario Context: ${systemPrompt || "Conversational Kannada practice"}

Target Audience: Non-Kannada speaker practicing spoken Kannada in Bengaluru.
Tone & Style:
- Use simple, spoken, everyday Bengaluru Kannada (colloquial words like 'saar', 'hogi', 'kodi', 'beka', 'eshtu', 'aaythu', 'banni', 'samosa').
- Keep reply brief: 1 to 2 short conversational sentences.
- Avoid overly complex, bookish, or Sanskritized Kannada.

Instruction:
Reply to the user's latest message strictly in JSON format.
You must return ONLY a single JSON object with these exact keys:
{
  "kannada": "<Spoken Kannada reply written in Kannada script>",
  "romanization": "<Clear English alphabet transliteration/romanization for pronunciation>",
  "english": "<Natural English translation of the reply>"
}

Conversation History:
${formattedHistory ? formattedHistory : "Start of conversation"}

User's Latest Message: "${userMessage.trim()}"

JSON Reply:`;

    const ai = new GoogleGenAI({ apiKey });

    let rawText = "";
    let modelUsed = GEMINI_MODEL;

    try {
      const result = await executeWithRetryAndFallback({
        primaryModel: GEMINI_MODEL,
        fallbackModel: GEMINI_FALLBACK_MODEL,
        operation: async (model) => {
          const response = await ai.models.generateContent({
            model,
            contents: promptText,
            config: {
              responseMimeType: "application/json",
            },
          });

          if (!response || !response.text) {
            throw new Error(`Model [${model}] returned an empty response.`);
          }

          return response.text;
        },
      });

      rawText = result.data;
      modelUsed = result.modelUsed;
    } catch (err: unknown) {
      console.error(`Gemini Chat error:`, err);
      const isBusy = (err as Record<string, unknown>)?.isBusy || isRetryableGeminiError(err);

      if (isBusy) {
        return NextResponse.json(
          {
            error: "The AI is busy, please try again in a few seconds",
            isBusy: true,
            canRetry: true,
          },
          { status: 503 }
        );
      }

      let errorMsg = extractGeminiErrorMessage(err);
      let status = 502;
      const anyErr = err as Record<string, unknown>;
      const code = anyErr?.status || anyErr?.statusCode;

      if (code === 401 || errorMsg.includes("401") || errorMsg.includes("API key not valid")) {
        status = 401;
        errorMsg = "API key not valid or unauthenticated (401). Please verify your GEMINI_API_KEY in .env.local.";
      } else if (code === 403 || errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
        status = 403;
        errorMsg = "Your project has been denied access (403 Permission Denied). Please check your API key.";
      }

      return NextResponse.json(
        {
          error: `Gemini API Error: ${errorMsg}`,
          model: modelUsed,
          canRetry: false,
        },
        { status }
      );
    }

    let parsed: { kannada?: string; romanization?: string; english?: string };
    try {
      parsed = extractJson(rawText);
    } catch {
      return NextResponse.json(
        {
          error: "Failed to parse AI response into the expected format. Please try again.",
          raw: rawText,
        },
        { status: 500 }
      );
    }

    if (!parsed.kannada) {
      return NextResponse.json(
        {
          error: "AI reply was missing Kannada text. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      kannada: parsed.kannada,
      romanization: parsed.romanization || "",
      english: parsed.english || "",
      model: modelUsed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected server error occurred.";
    return NextResponse.json(
      {
        error: `Server error: ${message}`,
      },
      { status: 500 }
    );
  }
}
