interface AccuracyResult {
  accuracy: number;
  baseScore: number;
}

const MAX_BASE_SCORE = 120;
const MAX_BONUS_SCORE = 20;
const BONUS_FULL_MS = 3000;
const BONUS_ZERO_MS = 7000;
export const MIN_SPEED_BONUS_ACCURACY = 0.3;

export function levenshteinDistance(a: string, b: string): number {
  const source = a.toUpperCase();
  const target = b.toUpperCase();

  const matrix: number[][] = Array.from({ length: source.length + 1 }, () =>
    Array.from({ length: target.length + 1 }, () => 0)
  );

  for (let i = 0; i <= source.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= target.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= source.length; i += 1) {
    for (let j = 1; j <= target.length; j += 1) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[source.length][target.length];
}

export function computeAccuracy(spell: string, guess: string): AccuracyResult {
  if (!spell.length) {
    return { accuracy: 0, baseScore: 0 };
  }

  const distance = levenshteinDistance(spell, guess);
  const maxLen = Math.max(spell.length, guess.length, 1);
  const accuracy = Math.max(0, 1 - distance / maxLen);
  const baseScore = Math.round(accuracy * MAX_BASE_SCORE);

  return { accuracy, baseScore };
}

export function computeSpeedBonus(durationMs: number): number {
  const clamped = Math.max(0, Math.min(durationMs, 60000));

  if (clamped <= BONUS_FULL_MS) {
    return MAX_BONUS_SCORE;
  }
  if (clamped >= BONUS_ZERO_MS) {
    return 0;
  }

  const ratio = (BONUS_ZERO_MS - clamped) / (BONUS_ZERO_MS - BONUS_FULL_MS);
  return Math.round(ratio * MAX_BONUS_SCORE);
}

export function computeRoundScore(spell: string, guess: string, durationMs: number) {
  const { accuracy, baseScore } = computeAccuracy(spell, guess);
  const bonusScore =
    accuracy >= MIN_SPEED_BONUS_ACCURACY ? computeSpeedBonus(durationMs) : 0;
  const totalScore = baseScore + bonusScore;

  return {
    accuracy,
    baseScore,
    bonusScore,
    totalScore,
  };
}
