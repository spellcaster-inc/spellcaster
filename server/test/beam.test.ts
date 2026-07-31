import { describe, expect, it } from 'vitest';
import {
  BEAM_SCORE_LEAD_TO_WIN,
  BEAM_THRESHOLD,
  calculateBeamOffset,
} from '../src/game/beam';

describe('calculateBeamOffset', () => {
  it('centers the beam when cumulative scores are tied', () => {
    expect(calculateBeamOffset(420, 420)).toBe(0);
  });

  it('maps cumulative score leads proportionally across the beam', () => {
    expect(calculateBeamOffset(70, 0)).toBe(25);
    expect(calculateBeamOffset(140, 0)).toBe(50);
    expect(calculateBeamOffset(210, 0)).toBe(75);
  });

  it('mirrors the position when player 1 leads', () => {
    expect(calculateBeamOffset(0, 70)).toBe(-25);
    expect(calculateBeamOffset(0, 140)).toBe(-50);
  });

  it('reaches the threshold at a 280-point lead', () => {
    expect(calculateBeamOffset(BEAM_SCORE_LEAD_TO_WIN, 0)).toBe(BEAM_THRESHOLD);
    expect(calculateBeamOffset(0, BEAM_SCORE_LEAD_TO_WIN)).toBe(-BEAM_THRESHOLD);
  });

  it('clamps score leads beyond the overwhelm threshold', () => {
    expect(calculateBeamOffset(500, 0)).toBe(BEAM_THRESHOLD);
    expect(calculateBeamOffset(0, 500)).toBe(-BEAM_THRESHOLD);
  });

  it('returns toward center when a trailing player closes the cumulative gap', () => {
    expect(calculateBeamOffset(220, 100)).toBeCloseTo(42.857, 3);
    expect(calculateBeamOffset(220, 180)).toBeCloseTo(14.286, 3);
  });
});
