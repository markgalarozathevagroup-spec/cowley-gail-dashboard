export default function LoadingState({ label = "Loading…", cards = 4 }: { label?: string; cards?: number }) {
  return (
    <div role="status" aria-live="polite">
      <p className="mb-3 text-base text-muted">{label}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-line bg-white p-5 animate-pulse">
            <div className="h-4 w-1/2 rounded bg-line" />
            <div className="mt-4 h-8 w-3/4 rounded bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
