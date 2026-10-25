import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, validateRequestBody } from "@/lib/rateLimit";
import {
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_FALLBACK_MODEL,
  GEMINI_TTS_MODEL,
  GEMINI_TTS_FALLBACK_MODEL,
  DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS,
  DEFAULT_GEMINI_RETRY_DELAYS,
  executeWithRetryAndFallback,
  isRetryableGeminiError,
  extractGeminiErrorMessage,
} from "@/lib/gemini";

// Re-export constants for external consumers & testing
export {
  DEFAULT_GEMINI_TTS_MODEL,
  DEFAULT_GEMINI_TTS_FALLBACK_MODEL,
  GEMINI_TTS_MODEL,
  GEMINI_TTS_FALLBACK_MODEL,
  DEFAULT_GEMINI_ATTEMPT_TIMEOUT_MS,
  DEFAULT_GEMINI_RETRY_DELAYS,
};

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
    // 1. Rate limiting: at most 20 requests per minute per IP address
    const rateLimit = checkRateLimit(req);
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response;
    }

    // 2. Reject request bodies larger than 20 KB
    const bodyResult = await validateRequestBody<{ text?: string }>(req);
    if (bodyResult.response) {
      return bodyResult.response;
    }

    const { text } = bodyResult.data || {};

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

    let audioBytes: Buffer | null = null;
    let mimeType = "audio/wav";
    let modelUsed = GEMINI_TTS_MODEL;

    try {
      const result = await executeWithRetryAndFallback({
        primaryModel: GEMINI_TTS_MODEL,
        fallbackModel: GEMINI_TTS_FALLBACK_MODEL,
        operation: async (model) => {
          const response = await ai.models.generateContent({
            model,
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

          let bytes: Buffer | null = null;
          let mime = "audio/wav";

          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                mime = part.inlineData.mimeType || "audio/wav";
                bytes = Buffer.from(part.inlineData.data, "base64");
                break;
              }
            }
          }

          if (!bytes || bytes.length === 0) {
            throw new Error(`TTS model [${model}] did not return audio data for this text.`);
          }

          return { bytes, mime };
        },
      });

      audioBytes = result.data.bytes;
      mimeType = result.data.mime;
      modelUsed = result.modelUsed;
    } catch (err: unknown) {
      console.error(`Gemini TTS error:`, err);
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
          error: `Gemini TTS Error: ${errorMsg}`,
          model: modelUsed,
          canRetry: false,
        },
        { status }
      );
    }

    if (!audioBytes || audioBytes.length === 0) {
      return NextResponse.json(
        {
          error: `Gemini TTS did not return audio data.`,
          model: modelUsed,
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
