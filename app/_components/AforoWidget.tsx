export function AforoWidget({
  current,
  capacity,
}: {
  current: number;
  capacity: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, capacity)) * 100)));

  return (
    <div className="rounded-xl border border-[#1e293b] bg-white/5 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <div className="section-kicker">Aforo</div>
        <div className="text-xs text-slate-400">{capacity} máx.</div>
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-3xl font-bold leading-none tracking-tight text-brand-green">{current}</div>
        <div className="text-sm text-slate-300">{pct}%</div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#0b1220]">
        <div className="h-full bg-brand-green" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

