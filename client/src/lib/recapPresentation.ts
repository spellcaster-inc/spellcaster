export const RECAP_SKIP_REQUIRED_VOTES = 2;

export function countRecapSkipVotes(
  playerIds: string[],
  recordedPlayerIds: string[],
  optimisticPlayerId: string | null = null,
) {
  const validPlayerIds = new Set(playerIds);
  const votes = new Set(recordedPlayerIds.filter((playerId) => validPlayerIds.has(playerId)));

  if (optimisticPlayerId && validPlayerIds.has(optimisticPlayerId)) {
    votes.add(optimisticPlayerId);
  }

  return Math.min(RECAP_SKIP_REQUIRED_VOTES, votes.size);
}
