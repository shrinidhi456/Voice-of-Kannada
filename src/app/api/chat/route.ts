import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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
- Use simple, spoken, everyday Bengaluru Kannada (colloquial words like 'saar', 'hogi', 'kodi', 'beka', 'eshtu', 'aaythu', 'banni').
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

    // Try current free flash models: gemini-2.5-flash, fallback to gemini-2.0-flash or gemini-1.5-flash
    const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let rawText = "";
    let lastError: unknown = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            responseMimeType: "application/json",
          },
        });
        if (response && response.text) {
          rawText = response.text;
          break;
        }
      } catch (err) {
        lastError = err;
        // Try next candidate model
        continue;
      }
    }

    if (!rawText) {
      const errMsg =
        lastError instanceof Error ? lastError.message : "Unknown Gemini API error";
      return NextResponse.json(
        {
          error: `Could not generate reply from Gemini: ${errMsg}. Please verify your API key and quota.`,
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
