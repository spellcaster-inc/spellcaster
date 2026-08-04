import { useEffect, useState } from 'react';
import type { Player, RecapSkipStatePayload, RoundRecapPayload } from '../../../shared/types/socket';
import { countRecapSkipVotes, RECAP_SKIP_REQUIRED_VOTES } from '../lib/recapPresentation';

interface RoundRecapCardProps {
  recap: RoundRecapPayload;
  players: Player[];
  localPlayerId: string | null;
  skipState: RecapSkipStatePayload | null;
  onSkip: () => void;
}

export function RoundRecapCard({ recap, players, localPlayerId, skipState, onSkip }: RoundRecapCardProps) {
  const [skipPending, setSkipPending] = useState(false);
  useEffect(() => setSkipPending(false), [recap.roundNumber]);
  const localVoted = Boolean(localPlayerId && skipState?.roundNumber === recap.roundNumber && skipState.playerIds.includes(localPlayerId));
  const recordedPlayerIds = skipState?.roundNumber === recap.roundNumber ? skipState.playerIds : [];
  const optimisticPlayerId = skipPending && !localVoted ? localPlayerId : null;
  const skipVoteCount = countRecapSkipVotes(
    players.map((player) => player.id),
    recordedPlayerIds,
    optimisticPlayerId,
  );
  const winner = players.find((player) => player.id === recap.winningPlayerId);

  return (
    <section className="card-glow mx-auto flex min-h-[280px] w-full max-w-2xl flex-col justify-center space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-4 text-center shadow-[0_30px_50px_rgba(4,0,23,0.7)] backdrop-blur-2xl sm:p-5" aria-labelledby="round-result-title">
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Revealed incantation</p>
        <h2 id="round-result-title" className="mt-1 break-words font-incantation text-2xl text-amber-200">{recap.spell}</h2>
        <p className="mt-1 text-sm font-semibold text-emerald-200">
          {winner ? `${winner.name}${winner.id === localPlayerId ? ' (you)' : ''} won the round` : 'The round ends in a tie'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {recap.playerResults.map((result) => (
          <div key={result.playerId} className={`rounded-2xl border p-3 ${recap.winningPlayerId === result.playerId ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-slate-950/35'}`}>
            <p className="truncate text-xs text-slate-300">{result.playerName}{result.playerId === localPlayerId ? ' (you)' : ''}</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-500">Spelled</p>
            <p className="min-h-5 break-all font-mono text-xs text-slate-100">{result.guess || 'No answer'}</p>
            <p className="mt-1 font-incantation text-3xl leading-none text-amber-100">{result.totalScore}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">round points</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[11px] text-slate-500">Full breakdown available after the duel.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => { setSkipPending(true); onSkip(); }}
            disabled={localVoted || skipPending}
            aria-pressed={localVoted || skipPending}
            className="rounded-xl border border-violet-300/40 bg-violet-500/15 px-5 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200/70 disabled:cursor-default disabled:opacity-60"
          >
            Skip to next spell
          </button>
          <span
            className="inline-flex min-w-8 items-center justify-center text-xs font-semibold tabular-nums text-violet-100"
            aria-label={`${skipVoteCount} of ${RECAP_SKIP_REQUIRED_VOTES} players ready to skip`}
            aria-live="polite"
          >
            {skipVoteCount}/{RECAP_SKIP_REQUIRED_VOTES}
          </span>
        </div>
      </div>
    </section>
  );
}
