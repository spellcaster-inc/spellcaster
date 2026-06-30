import { useEffect, useState } from 'react';
import type { CountdownPayload } from '../../../shared/types/socket';

export function useCountdownTimer(countdown: CountdownPayload | null): number | null {
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  useEffect(() => {
    if (!countdown) {
      setCountdownValue(null);
      return;
    }
    setCountdownValue(countdown.seconds);
    const interval = setInterval(() => {
      setCountdownValue((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          return 1;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  return countdownValue;
}
