import { describe, expect, it } from 'vitest';
import { getPromptTimeRemainingMs } from '../src/hooks/usePromptTimer';

describe('getPromptTimeRemainingMs', () => {
  const startedAt = '2026-07-31T12:00:00.000Z';
  const startedAtMs = Date.parse(startedAt);

  it('derives remaining time from the server timestamp and answer window', () => {
    expect(getPromptTimeRemainingMs(startedAt, 10_000, startedAtMs + 2_500)).toBe(7_500);
  });

  it('clamps the display before the start and after the deadline', () => {
    expect(getPromptTimeRemainingMs(startedAt, 10_000, startedAtMs - 1_000)).toBe(10_000);
    expect(getPromptTimeRemainingMs(startedAt, 10_000, startedAtMs + 12_000)).toBe(0);
  });

  it('safely handles invalid timing data', () => {
    expect(getPromptTimeRemainingMs('not-a-date', 10_000, startedAtMs)).toBe(0);
    expect(getPromptTimeRemainingMs(startedAt, 0, startedAtMs)).toBe(0);
  });
});
