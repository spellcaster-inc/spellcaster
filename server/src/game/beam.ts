export const BEAM_THRESHOLD = 100;
export const BEAM_SCORE_LEAD_TO_WIN = 280;

export function calculateBeamOffset(player0Score: number, player1Score: number): number {
  const scoreLead = player0Score - player1Score;
  const normalizedOffset = (scoreLead / BEAM_SCORE_LEAD_TO_WIN) * BEAM_THRESHOLD;

  return Math.max(-BEAM_THRESHOLD, Math.min(BEAM_THRESHOLD, normalizedOffset));
}
