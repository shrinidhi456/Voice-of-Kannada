/**
 * Levenshtein Distance & Word-level diff utilities for Kannada pronunciation scoring.
 */

// Calculate standard Levenshtein distance between two strings
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

// Normalize text for comparison: remove punctuation, normalize spaces
export function normalizeKannadaText(text: string): string {
  return text
    .replace(/[.,?!:;'"()\-–—_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WordDiffResult {
  word: string;
  status: "matched" | "mismatched" | "missing";
  spokenWord?: string;
}

export interface PronunciationScoreResult {
  score: number; // 0 - 100
  targetWords: WordDiffResult[];
  spokenWords: string[];
  isAccurate: boolean;
}

/**
 * Computes word-level diff and overall score (0-100)
 */
export function calculatePronunciationScore(
  targetPhrase: string,
  spokenTranscript: string
): PronunciationScoreResult {
  const normTarget = normalizeKannadaText(targetPhrase);
  const normSpoken = normalizeKannadaText(spokenTranscript);

  if (!normSpoken) {
    return {
      score: 0,
      targetWords: normTarget.split(" ").filter(Boolean).map((w) => ({
        word: w,
        status: "missing",
      })),
      spokenWords: [],
      isAccurate: false,
    };
  }

  const targetTokens = normTarget.split(" ").filter(Boolean);
  const spokenTokens = normSpoken.split(" ").filter(Boolean);

  // String level similarity via Levenshtein
  const maxLen = Math.max(normTarget.length, normSpoken.length);
  const charDistance = levenshteinDistance(normTarget, normSpoken);
  const charSimilarity = maxLen === 0 ? 1 : Math.max(0, 1 - charDistance / maxLen);

  // Word-level matching
  const matchedTargetIndices = new Set<number>();
  const targetWordsResult: WordDiffResult[] = [];

  let matchedWordCount = 0;

  targetTokens.forEach((tWord, tIdx) => {
    // Check if there is an exact or close match in spoken tokens
    let bestMatchIdx = -1;
    let bestMatchSim = 0;

    spokenTokens.forEach((sWord, sIdx) => {
      const sMaxLen = Math.max(tWord.length, sWord.length);
      const dist = levenshteinDistance(tWord, sWord);
      const sim = sMaxLen === 0 ? 1 : 1 - dist / sMaxLen;

      if (sim > bestMatchSim) {
        bestMatchSim = sim;
        bestMatchIdx = sIdx;
      }
    });

    if (bestMatchSim >= 0.75) {
      matchedTargetIndices.add(tIdx);
      matchedWordCount++;
      targetWordsResult.push({
        word: tWord,
        status: "matched",
        spokenWord: spokenTokens[bestMatchIdx],
      });
    } else if (bestMatchSim >= 0.45) {
      targetWordsResult.push({
        word: tWord,
        status: "mismatched",
        spokenWord: spokenTokens[bestMatchIdx],
      });
    } else {
      targetWordsResult.push({
        word: tWord,
        status: "missing",
      });
    }
  });

  const wordRatio = targetTokens.length === 0 ? 1 : matchedWordCount / targetTokens.length;

  // Composite score: 50% character-level similarity + 50% word-level accuracy
  let compositeScore = Math.round((charSimilarity * 0.5 + wordRatio * 0.5) * 100);

  // Exact string match gets 100
  if (normTarget === normSpoken) {
    compositeScore = 100;
  }

  // Bound between 0 and 100
  const finalScore = Math.max(0, Math.min(100, compositeScore));

  return {
    score: finalScore,
    targetWords: targetWordsResult,
    spokenWords: spokenTokens,
    isAccurate: finalScore >= 80,
  };
}
