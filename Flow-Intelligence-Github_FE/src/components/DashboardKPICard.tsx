import type { KPICard, DataStatus } from "../types/dashboard.js";

const TREND_CARD: Record<string, { border: string; bg: string; value: string }> = {
  good:    { border: "border-emerald-500/30", bg: "bg-emerald-500/8",  value: "text-emerald-400" },
  warn:    { border: "border-amber-500/30",   bg: "bg-amber-500/8",    value: "text-amber-400"   },
  bad:     { border: "border-rose-500/30",    bg: "bg-rose-500/8",     value: "text-rose-400"    },
  neutral: { border: "border-slate-700",      bg: "bg-slate-900/60",   value: "text-slate-200"   },
};

const STATUS_PILL: Record<DataStatus, { label: string; cls: string }> = {
  ok:               { label: "OK",      cls: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" },
  partial:          { label: "Partial", cls: "bg-amber-500/20   text-amber-300   border border-amber-500/40"   },
  insufficient_data:{ label: "No data", cls: "bg-slate-700      text-slate-400   border border-slate-600"       },
};

const ICONS: Record<string, string> = {
  open_pr_count:                "🔀",
  stale_pr_count:               "⏳",
  review_pickup_time_avg_hours: "⏱️",
  review_load_top_reviewer_pct: "👤",
  failed_check_rate_pct:        "🔴",
  pr_cycle_time_avg_hours:      "🔄",
};

interface Props { card: KPICard; loading?: boolean }

export function DashboardKPICard({ card, loading = false }: Props) {
  const ts  = TREND_CARD[card.trend];
  const sp  = STATUS_PILL[card.dataStatus];

  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-4 ${ts.border} ${ts.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{ICONS[card.key] ?? "📊"}</span>
          <span className="text-sm font-semibold text-slate-300 leading-snug">{card.label}</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex-shrink-0 ${sp.cls}`}>
          {sp.label}
        </span>
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-12 w-28 bg-slate-700/60 animate-pulse rounded-xl" />
      ) : card.value === null || card.dataStatus === "insufficient_data" ? (
        <div>
          <span className="text-4xl font-bold text-slate-600">—</span>
          <p className="text-xs text-slate-600 mt-2 italic">Insufficient data.</p>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold tabular-nums leading-none ${ts.value}`}>
            {card.unit === "%" ? card.value.toFixed(1)
              : Number.isInteger(card.value) ? card.value
              : card.value.toFixed(1)}
          </span>
          <span className="text-base text-slate-400">{card.unit}</span>
        </div>
      )}

      {/* Description */}
      {card.dataStatus !== "insufficient_data" && (
        <p className="text-xs text-slate-500 leading-relaxed border-t border-white/5 pt-3">
          {card.description}
        </p>
      )}
    </div>
  );
}
