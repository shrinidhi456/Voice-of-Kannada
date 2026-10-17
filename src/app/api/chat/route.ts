import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// 1. Current stable Gemini Flash model from official docs:
// https://ai.google.dev/gemini-api/docs/models/gemini
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

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
    const body = await req.json();
    const {
      role,
      systemPrompt,
      history = [],
      userMessage,
    }: {
      role?: string;
      systemPrompt?: string;
      history?: ChatMessage[];
      userMessage?: string;
    } = body;

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
      console.error(`Gemini API error with model [${GEMINI_MODEL}]:`, err);
      let errorMsg = err instanceof Error ? err.message : String(err);
      let status = 502;

      // Extract JSON error payload if returned by Google API
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed?.error) {
          const code = parsed.error.code;
          const msg = parsed.error.message || "";
          const statusStr = parsed.error.status || "";

          if (code === 403 || statusStr === "PERMISSION_DENIED") {
            errorMsg = `Your project has been denied access (403 Permission Denied). Please generate a fresh API key in Google AI Studio (https://aistudio.google.com/apikey) under a new project or complete account verification.`;
            status = 403;
          } else if (code === 404 || statusStr === "NOT_FOUND") {
            errorMsg = `Model '${GEMINI_MODEL}' was not found (404). Please verify GEMINI_MODEL in your environment.`;
            status = 404;
          } else if (code === 429 || statusStr === "RESOURCE_EXHAUSTED") {
            errorMsg = `Rate limit or quota exceeded (429). Please wait a moment before trying again.`;
            status = 429;
          } else {
            errorMsg = `${msg} (${code || statusStr})`;
          }
        }
      } catch {
        // Not a JSON formatted error string
      }

      return NextResponse.json(
        {
          error: `Gemini API Error [${GEMINI_MODEL}]: ${errorMsg}`,
          model: GEMINI_MODEL,
        },
        { status }
      );
    }

    if (!rawText) {
      return NextResponse.json(
        {
          error: `Gemini API [${GEMINI_MODEL}] returned an empty response. Please try again.`,
          model: GEMINI_MODEL,
        },
        { status: 502 }
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
      model: GEMINI_MODEL,
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
