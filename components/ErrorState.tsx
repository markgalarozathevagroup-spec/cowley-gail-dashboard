export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="err-box">
      <p>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}
