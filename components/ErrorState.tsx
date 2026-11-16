export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border-2 border-bad bg-white p-6">
      <p className="text-lg font-semibold text-bad">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 rounded-lg bg-navy px-5 py-3 text-base font-semibold text-white hover:opacity-90">
          Retry
        </button>
      )}
    </div>
  );
}
