interface ServerErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ServerErrorBanner({ message, onDismiss }: ServerErrorBannerProps) {
  return (
    <div className="rounded-lg border border-rose-600 bg-rose-900/30 px-3 py-2 text-sm text-rose-200 flex items-center justify-between gap-3">
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="text-xs uppercase tracking-wide underline underline-offset-2"
      >
        dismiss
      </button>
    </div>
  );
}
