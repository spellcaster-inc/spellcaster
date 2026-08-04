export function calculateFinisherOffset(start: number, target: -100 | 100, progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const eased = clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
  return start + (target - start) * eased;
}
