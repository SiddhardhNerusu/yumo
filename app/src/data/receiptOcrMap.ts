import type { ReceiptLine } from '@yumo/shared';

/**
 * Pure mapping from an OCR engine's block→line tree to the flat, reading-ordered
 * `ReceiptLine[]` that `parseReceipt` consumes. RN-free so it's unit-testable in
 * node. Keeps each line's vertical position (`top`) for reading order and future
 * two-column price re-pairing; drops blank lines.
 */
export interface OcrLine {
  text: string;
  frame?: { top: number };
}
export interface OcrBlock {
  lines: OcrLine[];
}

export function flattenReceiptBlocks(blocks: OcrBlock[]): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  for (const block of blocks) {
    for (const line of block.lines) {
      const text = (line.text ?? '').trim();
      if (!text) continue;
      lines.push(line.frame ? { text, top: line.frame.top } : { text });
    }
  }
  // top→bottom so the parser reads the receipt in order
  return lines.sort((a, b) => (a.top ?? 0) - (b.top ?? 0));
}
