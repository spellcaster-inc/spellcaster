import { describe, expect, it } from 'vitest';
import { calculateFinisherOffset } from '../src/lib/beamFinisher';

describe('calculateFinisherOffset', () => {
  it('preserves the real offset before the cosmetic sweep begins', () => {
    expect(calculateFinisherOffset(32, 100, 0)).toBe(32);
    expect(calculateFinisherOffset(-48, -100, -1)).toBe(-48);
  });

  it('ends at the server-provided target for either player side', () => {
    expect(calculateFinisherOffset(32, 100, 1)).toBe(100);
    expect(calculateFinisherOffset(-48, -100, 1)).toBe(-100);
  });

  it('clamps progress so the presentation cannot overshoot beam geometry', () => {
    expect(calculateFinisherOffset(10, 100, 2)).toBe(100);
    expect(calculateFinisherOffset(-10, -100, 2)).toBe(-100);
  });
});
