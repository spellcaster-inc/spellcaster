import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo';
import { RoundRecapCard } from '../components/RoundRecapCard';
import { CountdownDisplay } from '../components/CountdownDisplay';
import { OnScreenKeyboard } from '../components/OnScreenKeyboard';
import { WizardBeam } from '../components/WizardBeam';
import { SpellTimerRing } from '../components/SpellTimerRing';
import { usePromptTimer } from '../hooks/usePromptTimer';
import { blockSpellInputPaste, SPELL_PASTE_BLOCKED_MESSAGE } from '../lib/spellInputPaste';
import type { DuelFinisherPayload, DuelState, Player, CountdownPayload, SpellPromptPayload, RecapSkipStatePayload, RoundRecapPayload } from '../../../shared/types/socket';

interface GamePageProps {
  duel: DuelState;
  localPlayer: Player | null;
  countdown: CountdownPayload | null;
  countdownValue: number | null;
  prompt: SpellPromptPayload | null;
  roundRecap: RoundRecapPayload | null;
  scores: Record<string, number>;
  recapSkipState: RecapSkipStatePayload | null;
  finisher: DuelFinisherPayload | null;
  currentGuess: string;
  hasSubmitted: boolean;
  opponentSubmitted: boolean;
  opponent: Player | null;
  showResultsPending: boolean;
  onGuessChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitSpell: () => void;
  onSkipRecap: (roundNumber: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onLeaveDuel: () => void;
}

const GamePage: React.FC<GamePageProps> = ({
  duel,
  localPlayer,
  countdown,
  countdownValue,
  prompt,
  roundRecap,
  scores,
  recapSkipState,
  finisher,
  currentGuess,
  hasSubmitted,
  opponentSubmitted,
  opponent,
  showResultsPending,
  onGuessChange,
  onSubmitSpell,
  onSkipRecap,
  onKeyDown,
  inputRef,
  onLeaveDuel,
}) => {
  const [showPasteBlockedMessage, setShowPasteBlockedMessage] = useState(false);
  const pasteMessageTimeoutRef = useRef<number | null>(null);
  const currentRoundNumber = countdown?.roundNumber ?? prompt?.roundNumber ?? roundRecap?.roundNumber ?? duel.round ?? 1;
  const totalRounds = duel.totalRounds;
  const timer = usePromptTimer(prompt);
  const isTerminalRecap = Boolean(roundRecap && (roundRecap.roundNumber >= totalRounds || Math.abs(roundRecap.beamOffset) >= 100));

  useEffect(() => () => {
    if (pasteMessageTimeoutRef.current !== null) {
      window.clearTimeout(pasteMessageTimeoutRef.current);
    }
  }, []);

  const handleSpellPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    blockSpellInputPaste(event);
    setShowPasteBlockedMessage(true);

    if (pasteMessageTimeoutRef.current !== null) {
      window.clearTimeout(pasteMessageTimeoutRef.current);
    }
    pasteMessageTimeoutRef.current = window.setTimeout(() => {
      setShowPasteBlockedMessage(false);
      pasteMessageTimeoutRef.current = null;
    }, 1600);
  };

  const renderCastingPanel = () => (
    <div className="card-glow mx-auto flex min-h-[280px] w-full max-w-2xl flex-col justify-center space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-[0_30px_50px_rgba(4,0,23,0.7)] backdrop-blur-2xl sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-spellcaster text-base text-emerald-200 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">
          Type what you hear!
        </p>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          {prompt && (hasSubmitted ? (
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200" role="status">Spell submitted</span>
          ) : (
            <SpellTimerRing {...timer} />
          ))}
          {opponent && (
            <p className="text-xs text-slate-300">
              {opponentSubmitted ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  {opponent.name} cast their spell!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] motion-safe:animate-pulse" />
                  {opponent.name} is typing...
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        id="spell-input"
        value={currentGuess}
        onChange={onGuessChange}
        onKeyDown={onKeyDown}
        onPaste={handleSpellPaste}
        className="sr-only-input"
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />

      <div className="rounded-[20px] border border-white/10 bg-slate-950/40 p-2.5 shadow-inner space-y-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 px-1">Wizard Keyboard Feedback</p>
        <div className="w-full">
          <OnScreenKeyboard inputRef={inputRef} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <button
          type="button"
          onClick={onSubmitSpell}
          disabled={!prompt || hasSubmitted}
          className="group relative overflow-hidden rounded-2xl border border-emerald-200/40 bg-gradient-to-r from-emerald-500/30 via-indigo-600/30 to-cyan-500/30 px-3 py-1.5 text-xs font-spellcaster text-emerald-50 shadow-[0_12px_28px_rgba(6,95,70,0.45)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/70 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          title={!prompt ? 'Waiting for prompt...' : hasSubmitted ? 'Already submitted' : 'Cast your spell'}
        >
          <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
            <span className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-emerald-300/30 to-transparent blur-xl" />
            <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-cyan-300/30 to-transparent blur-xl" />
          </span>
          <span className="relative text-sm tracking-[0.1em]">
            {hasSubmitted ? (
              <span className="inline-flex items-center gap-1.5">
                Spell Casted
                <span className="inline-block text-sm">✔</span>
              </span>
            ) : (
              'Cast Spell'
            )}
          </span>
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-400 select-none">
          <span>or press</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-600/40 bg-slate-800/60 px-2 py-1 font-mono text-[10px] uppercase">
            enter
          </span>
          {showPasteBlockedMessage && (
            <span className="text-[10px] text-rose-200" role="status" aria-live="polite">
              {SPELL_PASTE_BLOCKED_MESSAGE}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-magic text-slate-100">
      {/* Enhanced background animations */}
      <div className="pointer-events-none absolute inset-0">
        <span className="magic-star" style={{ top: '10%', left: '20%', animationDelay: '0s' }} />
        <span className="magic-star" style={{ top: '25%', left: '80%', animationDelay: '1.5s' }} />
        <span className="magic-star" style={{ top: '50%', left: '15%', animationDelay: '3s' }} />
        <span className="magic-star" style={{ top: '70%', left: '75%', animationDelay: '4.5s' }} />
        <span className="magic-star" style={{ top: '35%', left: '50%', animationDelay: '6s' }} />
        <span className="shooting-star" style={{ top: '8%', right: '15%', animationDelay: '0.5s' }} />
        <span className="shooting-star" style={{ top: '45%', left: '8%', animationDelay: '3.5s' }} />
        <span className="shooting-star" style={{ top: '80%', right: '20%', animationDelay: '7s' }} />
        <span className="floating-spark" style={{ top: '15%', left: '30%', animationDelay: '0s' }} />
        <span className="floating-spark" style={{ top: '30%', left: '60%', animationDelay: '1s' }} />
        <span className="floating-spark" style={{ top: '55%', left: '25%', animationDelay: '2s' }} />
        <span className="floating-spark" style={{ top: '65%', left: '70%', animationDelay: '3s' }} />
        <span className="floating-spark" style={{ top: '20%', left: '85%', animationDelay: '4s' }} />
        <span className="floating-spark" style={{ top: '75%', left: '45%', animationDelay: '5s' }} />
        <span className="wand-ember" style={{ top: '12%', right: '25%', animationDelay: '1s' }} />
        <span className="wand-ember" style={{ bottom: '15%', left: '20%', animationDelay: '2.5s' }} />
        <span className="wand-ember" style={{ top: '40%', right: '10%', animationDelay: '4s' }} />
        <span className="wand-ember" style={{ bottom: '25%', right: '35%', animationDelay: '5.5s' }} />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-2">
        <div className="w-full max-w-4xl mx-auto space-y-2 flex-1 flex flex-col">
          {/* Header */}
          <header className="text-center space-y-1">
            <div className="flex items-center justify-between">
              <button
                onClick={onLeaveDuel}
                className="rounded-full border border-rose-300/40 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/20 hover:border-rose-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
              >
                Leave Duel
              </button>
              <div className="flex-1" />
            </div>
            <div className="scale-75 origin-top">
              <Logo />
            </div>
            <div className="flex items-center justify-center gap-4">
              <p className="font-spellcaster text-emerald-200 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] md:text-lg">
                Round {currentRoundNumber} of {totalRounds}
              </p>
            </div>
          </header>

          {/* Main content grows with its active state so controls remain inside the card. */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex min-h-[280px] items-center justify-center py-1">
              {roundRecap && !isTerminalRecap && (
                <RoundRecapCard
                  recap={roundRecap}
                  players={duel.players}
                  localPlayerId={localPlayer?.id ?? null}
                  skipState={recapSkipState}
                  onSkip={() => onSkipRecap(roundRecap.roundNumber)}
                />
              )}
              {roundRecap && isTerminalRecap && (
                <div className="card-glow mx-auto flex min-h-[280px] w-full max-w-2xl items-center justify-center rounded-[28px] border border-amber-300/20 bg-amber-400/5 p-6 text-center backdrop-blur-2xl" role="status">
                  <div><p className="font-incantation text-2xl text-amber-100">The final spell takes hold…</p><p className="mt-2 text-sm text-slate-300">Watch the duel decide the victor.</p></div>
                </div>
              )}
              {!roundRecap && countdown && countdownValue && (
                <CountdownDisplay
                  value={Math.max(1, Math.round(countdownValue))}
                  roundNumber={countdown.roundNumber}
                  totalRounds={countdown.totalRounds}
                />
              )}
              {!roundRecap && !countdown && prompt && renderCastingPanel()}

              {showResultsPending && (
                <div className="card-glow mx-auto flex min-h-[280px] w-full max-w-2xl items-center justify-center rounded-[28px] border border-amber-300/30 bg-amber-400/10 px-6 py-4 text-center shadow-[0_30px_50px_rgba(4,0,23,0.7)] backdrop-blur-2xl">
                  <p className="text-sm font-semibold text-amber-100">
                    Adjudicating this round... both wizards must finish before the scroll reveals your work.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Wizard Beam at Bottom */}
          <div className="mt-auto pt-2">
            <WizardBeam
              players={duel.players}
              scores={scores}
              beamOffset={duel.beamOffset}
              roundRecap={roundRecap}
              localPlayerId={localPlayer?.id ?? null}
              finisher={finisher}
            />
          </div>
        </div>
      </div>
    </main>
  );
};

export default GamePage;
