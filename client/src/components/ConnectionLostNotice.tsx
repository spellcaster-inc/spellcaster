interface ConnectionLostNoticeProps {
  wasInDuel: boolean;
  onDismiss: () => void;
}

export function ConnectionLostNotice({ wasInDuel, onDismiss }: ConnectionLostNoticeProps) {
  return (
    <div className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-30 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-amber-300/40 bg-slate-950/95 p-3 text-slate-100 shadow-lg sm:left-auto sm:right-6 sm:mx-0 sm:w-80">
      <svg aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9a14 14 0 0 1 3-2m4-1a14 14 0 0 1 11 3M6 13a9 9 0 0 1 4-2m4 0a9 9 0 0 1 4 2m-9 4a4 4 0 0 1 6 0m-3 4h.01M3 3l18 18" />
      </svg>
      <div role="alert" className="flex-1">
        <p className="text-sm font-semibold text-amber-200">Connection lost</p>
        <p className="text-sm text-slate-200">{wasInDuel ? 'The duel ended.' : 'You left the lobby.'}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss connection notice"
        onClick={onDismiss}
        className="shrink-0 rounded-lg px-2 text-lg leading-7 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
      >
        ×
      </button>
    </div>
  );
}
