import type { DataStatus } from "../types/metrics.js";

interface MetricCardProps {
  title: string;
  value: number | null;
  unit: string;
  subtitle?: string;
  status: DataStatus;
  trend?: "good" | "warn" | "bad" | "neutral";
  description?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

const TREND_VALUE: Record<string, string> = {
  good:    "text-emerald-400",
  warn:    "text-amber-400",
  bad:     "text-rose-400",
  neutral: "text-slate-200",
};

const TREND_CARD: Record<string, string> = {
  good:    "border-emerald-500/30 bg-emerald-500/8",
  warn:    "border-amber-500/30 bg-amber-500/8",
  bad:     "border-rose-500/30 bg-rose-500/8",
  neutral: "border-slate-700 bg-slate-900/60",
};

const STATUS_PILL: Record<DataStatus, { label: string; cls: string }> = {
  ok:               { label: "OK",       cls: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" },
  partial:          { label: "Partial",  cls: "bg-amber-500/20   text-amber-300   border border-amber-500/40"   },
  insufficient_data:{ label: "No data",  cls: "bg-slate-700      text-slate-400   border border-slate-600"       },
};

export function MetricCard({ title, value, unit, subtitle, status, trend = "neutral", description, icon, isLoading = false }: MetricCardProps) {
  const pill = STATUS_PILL[status];

  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-4 ${TREND_CARD[trend]}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-2xl">{icon}</span>}
          <span className="text-sm font-semibold text-slate-300 leading-snug">{title}</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      {/* Value */}
      {isLoading ? (
        <div className="h-12 w-32 bg-slate-700/60 animate-pulse rounded-xl" />
      ) : value === null || status === "insufficient_data" ? (
        <div>
          <span className="text-4xl font-bold text-slate-600">—</span>
          <p className="text-xs text-slate-600 mt-2 italic">Not enough data in this window.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold tabular-nums leading-none ${TREND_VALUE[trend]}`}>
              {unit === "%" ? value.toFixed(1) : Number.isInteger(value) ? value : value.toFixed(1)}
            </span>
            <span className="text-base text-slate-400">{unit}</span>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
        </div>
      )}

      {/* Description */}
      {description && status !== "insufficient_data" && (
        <p className="text-xs text-slate-500 leading-relaxed border-t border-white/5 pt-3">
          {description}
        </p>
      )}
    </div>
  );
}
