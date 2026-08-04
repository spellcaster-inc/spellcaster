import { describe, expect, it } from 'vitest';
import {
  computeAccuracy,
  computeRoundScore,
  computeSpeedBonus,
  levenshteinDistance,
  MIN_SPEED_BONUS_ACCURACY,
} from '../src/game/scoring';

describe('scoring', () => {
  describe('levenshteinDistance and accuracy', () => {
    it('grades guesses case-insensitively', () => {
      expect(levenshteinDistance('Fireball', 'fIrEbAlL')).toBe(0);
      expect(computeAccuracy('Fireball', 'fIrEbAlL')).toEqual({
        accuracy: 1,
        baseScore: 120,
      });
    });

    it('preserves insertion, deletion, and substitution behavior', () => {
      expect(levenshteinDistance('SPELL', 'SPEL')).toBe(1);
      expect(levenshteinDistance('SPELL', 'SPELLS')).toBe(1);
      expect(levenshteinDistance('SPELL', 'SMELL')).toBe(1);
      expect(computeAccuracy('SPELL', 'SPEL')).toEqual({
        accuracy: 0.8,
        baseScore: 96,
      });
    });

    it('returns zero accuracy and base score for an empty spell', () => {
      expect(computeAccuracy('', '')).toEqual({ accuracy: 0, baseScore: 0 });
    });
  });

  describe('computeSpeedBonus raw timing curve', () => {
    it.each([
      { durationMs: 0, expectedBonus: 20 },
      { durationMs: 3000, expectedBonus: 20 },
      { durationMs: 4000, expectedBonus: 15 },
      { durationMs: 5000, expectedBonus: 10 },
      { durationMs: 6000, expectedBonus: 5 },
      { durationMs: 7000, expectedBonus: 0 },
      { durationMs: 10_000, expectedBonus: 0 },
    ])('returns $expectedBonus points at $durationMs milliseconds', ({ durationMs, expectedBonus }) => {
      expect(computeSpeedBonus(durationMs)).toBe(expectedBonus);
    });
  });

  describe('computeRoundScore speed qualification', () => {
    it('awards the maximum score for a perfect fast answer', () => {
      expect(computeRoundScore('FIREBALL', 'fireball', 3000)).toEqual({
        accuracy: 1,
        baseScore: 120,
        bonusScore: 20,
        totalScore: 140,
      });
    });

    it('awards the speed bonus at exactly 30% accuracy', () => {
      const score = computeRoundScore('ABCDEFGHIJ', 'ABCXXXXXXX', 3000);

      expect(score.accuracy).toBeCloseTo(MIN_SPEED_BONUS_ACCURACY);
      expect(score.baseScore).toBe(36);
      expect(score.bonusScore).toBe(20);
      expect(score.totalScore).toBe(56);
    });

    it('removes the speed bonus below 30% accuracy', () => {
      const score = computeRoundScore('ABCDEFGHIJ', 'ABXXXXXXXX', 1000);

      expect(score.accuracy).toBeCloseTo(0.2);
      expect(score.baseScore).toBe(24);
      expect(score.bonusScore).toBe(0);
      expect(score.totalScore).toBe(24);
    });

    it('does not award speed points for a zero-accuracy fast answer', () => {
      expect(computeRoundScore('FIREBALL', 'XXXXXXXX', 1)).toEqual({
        accuracy: 0,
        baseScore: 0,
        bonusScore: 0,
        totalScore: 0,
      });
    });

    it('does not award speed points for an empty fast guess', () => {
      expect(computeRoundScore('FIREBALL', '', 1)).toEqual({
        accuracy: 0,
        baseScore: 0,
        bonusScore: 0,
        totalScore: 0,
      });
    });

    it.each([
      { durationMs: 4000, bonusScore: 15 },
      { durationMs: 5000, bonusScore: 10 },
      { durationMs: 6000, bonusScore: 5 },
      { durationMs: 7000, bonusScore: 0 },
    ])('preserves the qualifying timing curve at $durationMs ms', ({ durationMs, bonusScore }) => {
      const score = computeRoundScore('FIREBALL', 'FIREBALL', durationMs);

      expect(score.bonusScore).toBe(bonusScore);
      expect(score.totalScore).toBe(120 + bonusScore);
    });

    it('preserves accuracy points but awards no bonus at timeout', () => {
      expect(computeRoundScore('FIREBALL', 'FIREBAL', 10_000)).toEqual({
        accuracy: 0.875,
        baseScore: 105,
        bonusScore: 0,
        totalScore: 105,
      });
    });
  });
});
