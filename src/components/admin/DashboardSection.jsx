import React from "react";

export default function DashboardSection({ icon: Icon, title, subtitle, accent = "primary", stats, loading }) {
  const accentMap = {
    primary: "bg-primary/15 text-primary",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-600",
  };
  const tileAccent = accentMap[accent] || accentMap.primary;

  return (
    <section className="rounded-2xl border border-border bg-card treba-shadow">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tileAccent}`}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </header>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="bg-card px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">
              {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted" /> : s.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}