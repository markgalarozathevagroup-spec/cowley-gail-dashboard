export default function LoadingState({ label = "Loading…", cards = 4 }: { label?: string; cards?: number }) {
  return (
    <div role="status" aria-live="polite">
      <p className="hint" style={{ marginBottom: 10, fontSize: 14 }}>{label}</p>
      <div className="grid4" style={{ marginTop: 0 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card"><div className="skel" style={{ height: 14, width: "50%" }} /><div className="skel" style={{ height: 30, width: "75%", marginTop: 14 }} /></div>
        ))}
      </div>
    </div>
  );
}
