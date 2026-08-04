import type { GameSummary, Player } from '../../../shared/types/socket';

interface GameSummaryCardProps {
  summary: GameSummary;
  players: Player[];
  localPlayerId: string | null;
  onClose: () => void;
}

export function GameSummaryCard({ summary, players, localPlayerId, onClose }: GameSummaryCardProps) {
  const didWin = Boolean(localPlayerId && summary.winnerId === localPlayerId);
  const isDraw = summary.winnerId === null;
  const localPlayer = players.find((player) => player.id === localPlayerId);
  const localRole = localPlayer?.isHost ? 'defending' : 'challenging';
  const opponentRole = localRole === 'defending' ? 'challenging' : 'defending';
  const heroSummary = summary.players.find((player) => player.playerId === localPlayerId);
  const reasonLabelMap: Record<GameSummary['reason'], string> = {
    beam: 'Beam overwhelm',
    rounds: 'All rounds complete',
    forfeit: 'Victory by forfeit',
  };
  const reasonLabel = reasonLabelMap[summary.reason] ?? summary.reason;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4" role="dialog" aria-modal="true" aria-labelledby="duel-result-title">
      <div className="relative max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/10 bg-slate-950/70 p-4 sm:p-6 shadow-[0_25px_65px_rgba(4,0,24,0.85)]">
        <div className="relative z-10 space-y-8">
          <header
            className="rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-6 text-center text-slate-100 shadow-inner"
          >
            <h2
              id="duel-result-title"
              className={`font-spellcaster tracking-[0.3em] drop-shadow-[0_0_25px_rgba(0,0,0,0.35)] ${
                isDraw
                  ? 'text-amber-200 text-5xl sm:text-6xl'
                  : didWin
                  ? 'text-emerald-300 text-5xl sm:text-6xl'
                  : 'text-red-500 text-6xl sm:text-7xl'
              }`}
            >
              {isDraw ? 'Draw' : didWin ? 'Victory' : 'Defeat'}
            </h2>
            <p
              className={`mt-3 text-base font-incantation ${
                isDraw || didWin ? 'text-slate-200' : 'text-red-300'
              }`}
            >
              {isDraw
                ? 'The duel ends with both wizards evenly matched.'
                : didWin
                ? `You outspelled the ${opponentRole} wizard.`
                : `The ${opponentRole} wizard overwhelmed your aura.`}
            </p>
          </header>

          {heroSummary && (
            <section className="grid gap-4 md:grid-cols-3">
              <StatCard label="Average Accuracy" value={`${(heroSummary.averageAccuracy * 100).toFixed(1)}%`} />
              <StatCard label="Average Speed" value={`${(heroSummary.averageDurationMs / 1000).toFixed(2)}s`} />
              <StatCard label="Total Score" value={`${heroSummary.totalScore}`} />
            </section>
          )}

          <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Battle Scroll</p>
              <p className="text-xs text-slate-400">
                Reason:&nbsp;
                <span className="font-semibold text-slate-100">{reasonLabel}</span>
              </p>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-white/5 bg-slate-950/50 p-2">
              {summary.rounds.map((round) => {
                const winner = round.playerResults.find((result) => result.playerId === round.winningPlayerId);
                return (
                  <details key={`${round.roundNumber}-${round.spell}`} className="group rounded-xl border border-white/10 bg-slate-900/45 open:bg-slate-900/75">
                    <summary className="cursor-pointer list-none rounded-xl px-3 py-3 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 [&::-webkit-details-marker]:hidden">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                        <span className="text-xs text-slate-400">R{round.roundNumber}</span>
                        <div className="min-w-0"><p className="truncate font-incantation text-slate-100">{round.spell}</p><p className="truncate text-[10px] text-slate-500">{winner ? `${winner.playerName} won` : 'Round tied'}</p></div>
                        <div className="flex items-center gap-1.5">
                          {round.playerResults.map((result) => (
                            <span key={result.playerId} className="inline-flex max-w-24 items-center gap-1 rounded-full bg-slate-950/60 px-2 py-1 text-[10px] text-slate-300">
                              <span className="max-w-14 truncate">{result.playerName}</span>
                              <strong className="text-amber-100">{result.totalScore}</strong>
                            </span>
                          ))}
                          <span aria-hidden="true" className="text-violet-300 transition group-open:rotate-180">⌄</span>
                        </div>
                      </div>
                    </summary>
                    <div className="border-t border-white/10 p-3">
                      <p className="mb-3 text-xs text-slate-400">Correct spelling: <span className="break-all font-mono text-amber-200">{round.spell}</span></p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {round.playerResults.map((result) => (
                          <section key={result.playerId} aria-label={`${result.playerName}'s round ${round.roundNumber} breakdown`} className="min-w-0 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                            <h4 className="truncate text-sm font-semibold text-emerald-200">{result.playerName}{result.playerId === localPlayerId ? ' (you)' : ''}</h4>
                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                              <BreakdownItem label="Guess" value={result.guess || 'No answer'} mono />
                              <BreakdownItem label="Correct spelling" value={round.spell} mono />
                              <BreakdownItem label="Accuracy" value={`${Math.round(result.accuracy * 100)}%`} />
                              <BreakdownItem label="Typing speed" value={`${(result.durationMs / 1000).toFixed(2)}s`} />
                              <BreakdownItem label="Base score" value={`${result.baseScore}`} />
                              <BreakdownItem label="Speed bonus" value={`${result.bonusScore}`} />
                              <BreakdownItem label="Round total" value={`${result.totalScore}`} />
                              <BreakdownItem label="Cumulative total" value={`${result.cumulativeScore}`} />
                            </dl>
                          </section>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex items-center justify-center rounded-2xl border px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 ${
                didWin
                  ? 'border-emerald-200/40 bg-gradient-to-r from-emerald-500/30 via-indigo-600/30 to-cyan-500/30 text-emerald-50 shadow-[0_12px_28px_rgba(6,95,70,0.45)] focus-visible:ring-emerald-200/70'
                  : 'border-rose-200/40 bg-gradient-to-r from-rose-600/40 via-rose-700/40 to-rose-500/30 text-rose-50 shadow-[0_12px_28px_rgba(250,113,113,0.35)] focus-visible:ring-rose-200/70'
              }`}
            >
              Return to Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard = ({ label, value }: StatCardProps) => (
  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-950/70 p-4 text-center shadow-[0_12px_28px_rgba(4,0,22,0.6)]">
    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{label}</p>
    <p className="mt-2 text-3xl font-incantation text-amber-100 drop-shadow-[0_0_15px_rgba(251,191,36,0.45)]">
      {value}
    </p>
  </div>
);

function BreakdownItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-[9px] uppercase tracking-wider text-slate-500">{label}</dt><dd className={`${mono ? 'font-mono' : 'font-semibold'} break-words text-slate-100`}>{value}</dd></div>;
}
