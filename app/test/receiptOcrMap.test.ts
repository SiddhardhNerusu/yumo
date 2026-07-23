import { describe, it, expect } from 'vitest';
import { flattenReceiptBlocks, type OcrBlock } from '../src/data/receiptOcrMap';

describe('flattenReceiptBlocks', () => {
  it('flattens block→line tree, keeps top, sorts top→bottom', () => {
    const blocks: OcrBlock[] = [
      { lines: [{ text: 'Chicken breast 3.20', frame: { top: 120 } }] },
      { lines: [{ text: '2 Bananas 0.84', frame: { top: 40 } }, { text: 'TOTAL 4.04', frame: { top: 200 } }] },
    ];
    const out = flattenReceiptBlocks(blocks);
    expect(out.map((l) => l.text)).toEqual(['2 Bananas 0.84', 'Chicken breast 3.20', 'TOTAL 4.04']);
    expect(out.map((l) => l.top)).toEqual([40, 120, 200]);
  });

  it('drops blank/whitespace lines', () => {
    const blocks: OcrBlock[] = [{ lines: [{ text: '  ', frame: { top: 1 } }, { text: 'Milk 1.20', frame: { top: 2 } }] }];
    expect(flattenReceiptBlocks(blocks).map((l) => l.text)).toEqual(['Milk 1.20']);
  });

  it('tolerates missing frames (no top) without crashing', () => {
    const blocks: OcrBlock[] = [{ lines: [{ text: 'Eggs 1.50' }, { text: 'Bread 0.90' }] }];
    const out = flattenReceiptBlocks(blocks);
    expect(out).toHaveLength(2);
    expect(out.every((l) => l.top === undefined)).toBe(true);
  });

  it('empty in → empty out', () => {
    expect(flattenReceiptBlocks([])).toEqual([]);
  });
});
