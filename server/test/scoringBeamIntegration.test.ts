import { describe, expect, it } from 'vitest';
import { calculateBeamOffset } from '../src/game/beam';
import { computeRoundScore } from '../src/game/scoring';

describe('scoring to beam integration', () => {
  it('derives mirrored beam offsets from cumulative scores in lobby player order', () => {
    const player0Rounds = [
      computeRoundScore('FIREBALL', 'FIREBALL', 3000),
      computeRoundScore('ABCDEFGHIJ', 'ABXXXXXXXX', 1000),
    ];
    const player1Rounds = [
      computeRoundScore('FIREBALL', 'FIREBAL', 5000),
      computeRoundScore('ABCDEFGHIJ', 'XXXXXXXXXX', 1000),
    ];

    const player0Score = player0Rounds.reduce((sum, round) => sum + round.totalScore, 0);
    const player1Score = player1Rounds.reduce((sum, round) => sum + round.totalScore, 0);

    expect(player0Score).toBe(164);
    expect(player1Score).toBe(115);
    expect(calculateBeamOffset(player0Score, player1Score)).toBe(17.5);
    expect(calculateBeamOffset(player1Score, player0Score)).toBe(-17.5);
  });
});
