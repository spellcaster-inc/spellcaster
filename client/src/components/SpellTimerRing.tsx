interface SpellTimerRingProps {
  remainingMs: number;
  remainingSeconds: number;
  progress: number;
}

const SIZE = 48;
const RADIUS = 19;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SpellTimerRing({ remainingMs, remainingSeconds, progress }: SpellTimerRingProps) {
  const urgent = remainingMs <= 3_000;
  const safeProgress = Math.max(0, Math.min(1, progress));
  return (
    <div
      className={`relative h-12 w-12 shrink-0 ${urgent ? 'text-rose-300' : 'text-emerald-300'}`}
      role="timer"
      aria-live={urgent ? 'polite' : 'off'}
      aria-label={`${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'} remaining`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-12 w-12 -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={RADIUS} fill="rgba(2,6,23,.72)" stroke="rgba(148,163,184,.2)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - safeProgress)}
          className={urgent ? 'motion-safe:animate-pulse' : ''}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-incantation text-sm font-bold text-white">
        {remainingSeconds}
      </span>
      {urgent && <span className="sr-only">Time is running low.</span>}
    </div>
  );
}
