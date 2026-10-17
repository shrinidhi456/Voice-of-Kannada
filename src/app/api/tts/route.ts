import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Official Gemini TTS model from Google AI documentation:
// https://ai.google.dev/gemini-api/docs/models/gemini
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
export const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL;

/**
 * Converts raw PCM audio buffer to a playable standard 16-bit WAV file buffer.
 * If the buffer is already a WAV file (starts with 'RIFF'), returns it as is.
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.toString("ascii", 0, 4) === "RIFF") {
    return pcmBuffer;
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // 'fmt ' sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // 'data' sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: NextRequest) {
  try {
    const { text }: { text?: string } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Please provide Kannada text to convert to speech." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured on the server. Please add your key in .env.local to use text-to-speech.",
        },
        { status: 401 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Request speech audio using Gemini TTS model
    let audioBytes: Buffer | null = null;
    let mimeType = "audio/wav";

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_TTS_MODEL,
        contents: text.trim(),
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore",
              },
            },
          },
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            mimeType = part.inlineData.mimeType || "audio/wav";
            audioBytes = Buffer.from(part.inlineData.data, "base64");
            break;
          }
        }
      }
    } catch (err: unknown) {
      console.error(`Gemini TTS error with model [${GEMINI_TTS_MODEL}]:`, err);
      let errorMsg = err instanceof Error ? err.message : String(err);
      let status = 502;

      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed?.error) {
          const code = parsed.error.code;
          const msg = parsed.error.message || "";
          const statusStr = parsed.error.status || "";

          if (code === 403 || statusStr === "PERMISSION_DENIED") {
            errorMsg = `Your Google Cloud / AI Studio project has been denied access (403 Permission Denied). Please check your API key in Google AI Studio.`;
            status = 403;
          } else if (code === 401 || statusStr === "UNAUTHENTICATED") {
            errorMsg = `API key not valid or unauthenticated (401). Please verify your GEMINI_API_KEY in .env.local.`;
            status = 401;
          } else if (code === 404 || statusStr === "NOT_FOUND") {
            errorMsg = `TTS Model '${GEMINI_TTS_MODEL}' was not found (404).`;
            status = 404;
          } else if (code === 429 || statusStr === "RESOURCE_EXHAUSTED") {
            errorMsg = `TTS rate limit or quota exceeded (429). Please wait a moment.`;
            status = 429;
          } else {
            errorMsg = `${msg} (${code || statusStr})`;
          }
        }
      } catch {
        // Not a JSON error string
      }

      return NextResponse.json(
        {
          error: `Gemini TTS Error [${GEMINI_TTS_MODEL}]: ${errorMsg}`,
          model: GEMINI_TTS_MODEL,
        },
        { status }
      );
    }

    if (!audioBytes || audioBytes.length === 0) {
      return NextResponse.json(
        {
          error: `Gemini TTS [${GEMINI_TTS_MODEL}] did not return audio data for this text.`,
          model: GEMINI_TTS_MODEL,
        },
        { status: 502 }
      );
    }

    // Convert raw PCM to playable standard WAV if needed
    const finalAudioBuffer =
      mimeType.includes("pcm") || mimeType.includes("raw") || !audioBytes.toString("ascii", 0, 4).startsWith("RIFF")
        ? pcmToWav(audioBytes)
        : audioBytes;

    return new NextResponse(new Uint8Array(finalAudioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": finalAudioBuffer.length.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected TTS server error occurred.";
    return NextResponse.json(
      {
        error: `Server TTS error: ${message}`,
      },
      { status: 500 }
    );
  }
}
