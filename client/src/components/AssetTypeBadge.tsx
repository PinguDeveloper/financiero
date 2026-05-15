const STYLES: Record<string, string> = {
  Ações: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
  FIIs: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  ETFs: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
  BDRs: "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30",
  Criptoativos: "bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/30",
  Outros: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/35",
};

export function AssetTypeBadge({ type }: { type: string }) {
  const cls = STYLES[type] ?? STYLES.Outros!;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {type}
    </span>
  );
}
