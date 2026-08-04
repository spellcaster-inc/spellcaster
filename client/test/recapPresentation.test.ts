import { describe, expect, it } from 'vitest';
import { countRecapSkipVotes, RECAP_SKIP_REQUIRED_VOTES } from '../src/lib/recapPresentation';

describe('countRecapSkipVotes', () => {
  const players = ['player-one', 'player-two'];

  it('moves through the visible zero, one, and two vote states', () => {
    expect(countRecapSkipVotes(players, [])).toBe(0);
    expect(countRecapSkipVotes(players, ['player-one'])).toBe(1);
    expect(countRecapSkipVotes(players, players)).toBe(RECAP_SKIP_REQUIRED_VOTES);
  });

  it('shows the local vote immediately while the server acknowledgement is pending', () => {
    expect(countRecapSkipVotes(players, [], 'player-one')).toBe(1);
    expect(countRecapSkipVotes(players, ['player-two'], 'player-one')).toBe(2);
  });

  it('ignores duplicate, stale, and non-participant vote ids', () => {
    expect(countRecapSkipVotes(players, ['player-one', 'player-one', 'former-player'])).toBe(1);
  });
});
