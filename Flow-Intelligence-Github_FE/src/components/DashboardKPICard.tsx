import type { KPICard, DataStatus } from "../types/dashboard.js";

const TREND_CARD: Record<string, { border: string; bg: string; value: string }> = {
  good:    { border: "border-emerald-200", bg: "bg-emerald-50/50",  value: "text-emerald-600" },
  warn:    { border: "border-amber-200",   bg: "bg-amber-50/50",    value: "text-amber-600"   },
  bad:     { border: "border-rose-200",    bg: "bg-rose-50/50",     value: "text-rose-600"    },
  neutral: { border: "border-slate-200",   bg: "bg-white",          value: "text-slate-800"   },
};

const STATUS_PILL: Record<DataStatus, { label: string; cls: string }> = {
  ok:               { label: "OK",      cls: "bg-emerald-50 text-emerald-700 border border-emerald-200/60" },
  partial:          { label: "Partial", cls: "bg-amber-50 text-amber-700 border border-amber-200/60"   },
  insufficient_data:{ label: "No data", cls: "bg-slate-100 text-slate-500 border border-slate-200"       },
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
  const ts  = TREND_CARD[card.trend] || TREND_CARD.neutral;
  const sp  = STATUS_PILL[card.dataStatus] || STATUS_PILL.insufficient_data;

  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-4 shadow-sm transition-shadow hover:shadow-md ${ts.border} ${ts.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{ICONS[card.key] ?? "📊"}</span>
          <span className="text-sm font-semibold text-slate-700 leading-snug">{card.label}</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex-shrink-0 ${sp.cls}`}>
          {sp.label}
        </span>
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-12 w-28 bg-slate-200/80 animate-pulse rounded-xl" />
      ) : card.value === null || card.dataStatus === "insufficient_data" ? (
        <div>
          <span className="text-4xl font-bold text-slate-300">—</span>
          <p className="text-xs text-slate-400 mt-2 italic">Insufficient data.</p>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold tabular-nums leading-none ${ts.value}`}>
            {card.unit === "%" ? card.value.toFixed(1)
              : Number.isInteger(card.value) ? card.value
              : card.value.toFixed(1)}
          </span>
          <span className="text-base text-slate-500">{card.unit}</span>
        </div>
      )}

      {/* Description */}
      {card.dataStatus !== "insufficient_data" && (
        <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          {card.description}
        </p>
      )}
    </div>
  );
}
