import { NextRequest, NextResponse } from "next/server";

export const RATE_LIMIT_MAX_REQUESTS = 20;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute in milliseconds
export const MAX_BODY_BYTES = 20 * 1024; // 20 KB (20,480 bytes)

interface RateLimitRecord {
  timestamps: number[];
}

declare global {
  // eslint-disable-next-line no-var
  var __voiceOfKannadaRateLimitStore: Map<string, RateLimitRecord> | undefined;
}

// In-memory store persisted across hot reloads in Next.js development
const store: Map<string, RateLimitRecord> =
  globalThis.__voiceOfKannadaRateLimitStore ||
  (globalThis.__voiceOfKannadaRateLimitStore = new Map());

/**
 * Extracts client IP address from proxy headers or defaults to 127.0.0.1
 */
export function getClientIp(req: NextRequest | Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Checks in-memory rate limit: at most 20 requests per minute per IP address.
 * When exceeded, returns HTTP 429 with a friendly JSON message.
 */
export function checkRateLimit(req: NextRequest): {
  allowed: boolean;
  retryAfter: number;
  response?: NextResponse;
} {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let record = store.get(ip);
  if (!record) {
    record = { timestamps: [] };
    store.set(ip, record);
  }

  // Filter timestamps within current 60-second window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestTimestamp = record.timestamps[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW_MS - now) / 1000)
    );

    return {
      allowed: false,
      retryAfter: retryAfterSeconds,
      response: NextResponse.json(
        {
          error:
            "Too many requests. You can make at most 20 requests per minute. Please wait a moment and try again.",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
            "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      ),
    };
  }

  // Record this request timestamp
  record.timestamps.push(now);

  // Periodic cleanup if store grows large
  if (store.size > 2000) {
    for (const [k, v] of store.entries()) {
      v.timestamps = v.timestamps.filter((ts) => ts > windowStart);
      if (v.timestamps.length === 0) {
        store.delete(k);
      }
    }
  }

  return {
    allowed: true,
    retryAfter: 0,
  };
}

/**
 * Validates that the request body does not exceed 20 KB (20,480 bytes).
 * Returns parsed JSON or an HTTP 413 error response.
 */
export async function validateRequestBody<T = Record<string, unknown>>(
  req: NextRequest
): Promise<{ data?: T; response?: NextResponse }> {
  // 1. Check Content-Length header if present
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!isNaN(parsedLength) && parsedLength > MAX_BODY_BYTES) {
      return {
        response: NextResponse.json(
          {
            error: `Request body exceeds the 20 KB limit (${parsedLength} bytes received). Please reduce request size.`,
          },
          { status: 413 }
        ),
      };
    }
  }

  // 2. Read raw text to check exact byte length
  let rawText = "";
  try {
    rawText = await req.text();
  } catch {
    return {
      response: NextResponse.json(
        { error: "Failed to read request body." },
        { status: 400 }
      ),
    };
  }

  const byteLength = Buffer.byteLength(rawText, "utf8");
  if (byteLength > MAX_BODY_BYTES) {
    return {
      response: NextResponse.json(
        {
          error: `Request body exceeds the 20 KB limit (${byteLength} bytes received). Please reduce request size.`,
        },
        { status: 413 }
      ),
    };
  }

  if (!rawText.trim()) {
    return { data: {} as T };
  }

  try {
    const data = JSON.parse(rawText) as T;
    return { data };
  } catch {
    return {
      response: NextResponse.json(
        { error: "Invalid JSON format in request body." },
        { status: 400 }
      ),
    };
  }
}

/**
 * Helper to reset rate limits (primarily for testing)
 */
export function resetRateLimits(): void {
  store.clear();
}
