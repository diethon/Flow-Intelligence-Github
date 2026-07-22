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
  good:    "text-emerald-600",
  warn:    "text-amber-600",
  bad:     "text-rose-600",
  neutral: "text-slate-800",
};

const TREND_CARD: Record<string, string> = {
  good:    "border-emerald-200 bg-emerald-50/50",
  warn:    "border-amber-200 bg-amber-50/50",
  bad:     "border-rose-200 bg-rose-50/50",
  neutral: "border-slate-200 bg-white shadow-sm",
};

const STATUS_PILL: Record<DataStatus, { label: string; cls: string }> = {
  ok:               { label: "OK",       cls: "bg-emerald-50 text-emerald-700 border border-emerald-200/60" },
  partial:          { label: "Partial",  cls: "bg-amber-50 text-amber-700 border border-amber-200/60"   },
  insufficient_data:{ label: "No data",  cls: "bg-slate-100 text-slate-500 border border-slate-200"       },
};

export function MetricCard({ title, value, unit, subtitle, status, trend = "neutral", description, icon, isLoading = false }: MetricCardProps) {
  const pill = STATUS_PILL[status] || STATUS_PILL.insufficient_data;

  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-4 transition-shadow hover:shadow-md ${TREND_CARD[trend] || TREND_CARD.neutral}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-2xl">{icon}</span>}
          <span className="text-sm font-semibold text-slate-700 leading-snug">{title}</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      {/* Value */}
      {isLoading ? (
        <div className="h-12 w-32 bg-slate-200/80 animate-pulse rounded-xl" />
      ) : value === null || status === "insufficient_data" ? (
        <div>
          <span className="text-4xl font-bold text-slate-300">—</span>
          <p className="text-xs text-slate-400 mt-2 italic">Not enough data in this window.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold tabular-nums leading-none ${TREND_VALUE[trend] || TREND_VALUE.neutral}`}>
              {unit === "%" ? value.toFixed(1) : Number.isInteger(value) ? value : value.toFixed(1)}
            </span>
            <span className="text-base text-slate-500">{unit}</span>
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
        </div>
      )}

      {/* Description */}
      {description && status !== "insufficient_data" && (
        <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          {description}
        </p>
      )}
    </div>
  );
}
