import { useEffect, useState } from 'react';
import type { SpellPromptPayload } from '../../../shared/types/socket';

export function getPromptTimeRemainingMs(
  startedAt: string,
  answerWindowMs: number,
  nowMs: number
): number {
  const startedAtMs = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs) || answerWindowMs <= 0) return 0;
  return Math.max(0, Math.min(answerWindowMs, startedAtMs + answerWindowMs - nowMs));
}

export function usePromptTimer(prompt: SpellPromptPayload | null) {
  const getRemaining = () =>
    prompt ? getPromptTimeRemainingMs(prompt.startedAt, prompt.answerWindowMs, Date.now()) : 0;
  const [remainingMs, setRemainingMs] = useState(getRemaining);

  useEffect(() => {
    if (!prompt) {
      setRemainingMs(0);
      return;
    }
    const update = () => setRemainingMs(getPromptTimeRemainingMs(prompt.startedAt, prompt.answerWindowMs, Date.now()));
    update();
    const intervalId = window.setInterval(update, 100);
    return () => window.clearInterval(intervalId);
  }, [prompt?.promptId, prompt?.startedAt, prompt?.answerWindowMs]);

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    progress: prompt?.answerWindowMs ? remainingMs / prompt.answerWindowMs : 0,
  };
}
