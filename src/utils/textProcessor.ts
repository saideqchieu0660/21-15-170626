/**
 * Splits input text into smaller, logically sound chunks based on configurable word/character thresholds.
 * Prioritizes dividing at natural boundaries like paragraphs (\n\n), line breaks (\n), or sentence enders (. ? !).
 * Guarantees strict index advancement in each iteration to prevent infinite loops.
 */

export interface ChunkingOptions {
  maxWords?: number;     // e.g. 100-150 words per chunk
  maxChars?: number;     // e.g. 1000-1500 characters per chunk
  overlapWords?: number; // overlapping words at translation boundary for context continuity
}

export interface ChunkResult {
  text: string;
  words: string[];
  wordCount: number;
  charCount: number;
}

export function splitIntoChunks(text: string, options: ChunkingOptions = {}): ChunkResult[] {
  const maxWords = options.maxWords ?? 150;
  const maxChars = options.maxChars ?? 2500;
  let overlapWords = options.overlapWords ?? Math.round(maxWords * 0.15); // 15% overlap by default

  if (!text || !text.trim()) {
    return [];
  }

  // Ensure overlap configuration is logical
  if (overlapWords >= maxWords) {
    overlapWords = Math.floor(maxWords * 0.15);
  }

  // Normalize line endings to LF (\n) and trim extra spacing
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // Split on paragraph boundaries, line breaks, or punctuation boundaries
  const rawSegments = normalizedText.split(/(\n\n+|\n|(?<=[.?!])\s+)/);
  const segments: string[] = [];

  for (const item of rawSegments) {
    if (!item) continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;

    const itemWords = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (itemWords.length <= maxWords) {
      segments.push(trimmed);
    } else {
      // Sub-slice extremely long lines or segments by word count
      let wIndex = 0;
      while (wIndex < itemWords.length) {
        const slice = itemWords.slice(wIndex, wIndex + maxWords);
        if (slice.length > 0) {
          segments.push(slice.join(" "));
        }
        wIndex += maxWords;
      }
    }
  }

  const chunks: ChunkResult[] = [];
  let currentSegmentIdx = 0;
  let chunkCounter = 0;

  const countWords = (txt: string) => txt.split(/\s+/).filter(w => w.length > 0).length;

  while (currentSegmentIdx < segments.length) {
    const currentChunkSegments: string[] = [];
    let currentWordsAccumulated = 0;
    let currentCharsAccumulated = 0;

    let segmentPointer = currentSegmentIdx;
    let advancedAtLeastOne = false;

    while (segmentPointer < segments.length) {
      const segmentText = segments[segmentPointer];
      const segWordsCount = countWords(segmentText);
      const segCharsCount = segmentText.length;

      // Stop accumulating if standard thresholds are crossed
      if (advancedAtLeastOne) {
        if (currentWordsAccumulated + segWordsCount > maxWords || currentCharsAccumulated + segCharsCount > maxChars) {
          break;
        }
      }

      currentChunkSegments.push(segmentText);
      currentWordsAccumulated += segWordsCount;
      currentCharsAccumulated += segCharsCount;
      segmentPointer++;
      advancedAtLeastOne = true;
    }

    // Combine accumulated segments into an optimal block
    const chunkCombinedText = currentChunkSegments.join("\n");
    const chunkWordsArray = chunkCombinedText.split(/\s+/).filter(w => w.length > 0);

    chunks.push({
      text: chunkCombinedText,
      words: chunkWordsArray,
      wordCount: chunkWordsArray.length,
      charCount: chunkCombinedText.length
    });

    // Sliding window mechanism with overlap
    const actualAdvanceCount = segmentPointer - currentSegmentIdx;
    if (actualAdvanceCount <= 0) {
      currentSegmentIdx++;
    } else {
      let nextStartIndex = segmentPointer;

      if (overlapWords > 0 && segmentPointer < segments.length) {
        let backedSegmentPointer = segmentPointer - 1;
        let gatheredOverlapWords = 0;

        while (backedSegmentPointer > currentSegmentIdx) {
          const segWords = countWords(segments[backedSegmentPointer]);
          if (gatheredOverlapWords + segWords > overlapWords) {
            break;
          }
          gatheredOverlapWords += segWords;
          nextStartIndex = backedSegmentPointer;
          backedSegmentPointer--;
        }
      }

      // Strong validation forward step safety to avoid infinite loops
      if (nextStartIndex > currentSegmentIdx) {
        currentSegmentIdx = nextStartIndex;
      } else {
        currentSegmentIdx = segmentPointer;
      }
    }

    chunkCounter++;
    if (chunkCounter > 5000) {
      console.warn("[splitIntoChunks Warning] Safety loop breaker activated.");
      break;
    }
  }

  return chunks;
}
