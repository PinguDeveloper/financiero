export function PageSkeleton() {
  const bar =
    "animate-shimmer rounded-md bg-gradient-to-r from-slate-700/50 via-slate-600/70 to-slate-700/50 bg-[length:200%_100%]";
  return (
    <div className="mt-10 space-y-10" aria-hidden>
      <div className="grid gap-5 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-7 shadow-inner"
          >
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} mt-4 h-9 w-40`} />
          </div>
        ))}
      </div>
      <div className="card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6">
        <div className={`${bar} h-4 w-48`} />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${bar} h-10 w-full`} />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 ${bar} h-72`} />
        <div className={`card-interactive rounded-2xl border border-surface-border bg-surface-raised p-6 ${bar} h-72`} />
      </div>
    </div>
  );
}
