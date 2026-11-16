export function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const W = 80, H = 28;
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - ((v - mn) / range) * (H - 4) - 2]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <div className="spark" aria-hidden>
      <svg className="spark-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={`${path} L${W},${H} L0,${H} Z`} fill={`${color}22`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    </div>
  );
}
