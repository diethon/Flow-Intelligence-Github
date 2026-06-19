import { useState } from "react";
import type { BottleneckCard as IBottleneckCard } from "../types/dashboard.js";

const RULE_ICONS: Record<string, string> = {
  R1: "⏳", R2: "⏱️", R3: "👤", R4: "🔴", R5: "📦",
};

const RULE_ACCENT: Record<string, { triggered: string; ok: string; bar: string; badge: string }> = {
  R1: { triggered: "border-rose-500/40 bg-rose-500/8",    ok: "border-slate-700/60 bg-slate-900/40", bar: "bg-rose-500",   badge: "bg-rose-500/20 text-rose-300 border-rose-500/40"   },
  R2: { triggered: "border-amber-500/40 bg-amber-500/8",  ok: "border-slate-700/60 bg-slate-900/40", bar: "bg-amber-500",  badge: "bg-amber-500/20 text-amber-300 border-amber-500/40"  },
  R3: { triggered: "border-amber-500/40 bg-amber-500/8",  ok: "border-slate-700/60 bg-slate-900/40", bar: "bg-amber-500",  badge: "bg-amber-500/20 text-amber-300 border-amber-500/40"  },
  R4: { triggered: "border-rose-500/40 bg-rose-500/8",    ok: "border-slate-700/60 bg-slate-900/40", bar: "bg-rose-500",   badge: "bg-rose-500/20 text-rose-300 border-rose-500/40"   },
  R5: { triggered: "border-orange-500/40 bg-orange-500/8",ok: "border-slate-700/60 bg-slate-900/40", bar: "bg-orange-500", badge: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
};

interface Props {
  card: IBottleneckCard;
  onDrillDown?: (ruleCode: string) => void;
}

export function BottleneckCard({ card, onDrillDown }: Props) {
  const [expanded, setExpanded] = useState(false);
  const acc = RULE_ACCENT[card.ruleCode] ?? RULE_ACCENT.R1;
  const cls = card.isTriggered ? acc.triggered : acc.ok;

  const metricFmt =
    card.metricValue === null ? "—"
    : card.thresholdUnit === "%" ? `${card.metricValue.toFixed(1)}%`
    : card.thresholdUnit === "hours" ? `${card.metricValue.toFixed(1)}h`
    : String(Math.round(card.metricValue));

  const thresholdFmt =
    card.thresholdUnit === "%" ? `${card.threshold}%`
    : card.thresholdUnit === "hours" ? `${card.threshold}h`
    : String(card.threshold);

  const progress = card.threshold > 0 && card.metricValue !== null
    ? Math.min((card.metricValue / (card.threshold * 1.5)) * 100, 100)
    : 0;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${cls}`}>
      <div className="flex">
        {/* Left accent stripe */}
        <div className={`w-1 flex-shrink-0 ${card.isTriggered ? acc.bar : "bg-slate-800"}`} />

        <div className="flex-1 p-5">
          {/* Main row */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Icon */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 flex items-center justify-center text-lg sm:text-xl flex-shrink-0">
              {RULE_ICONS[card.ruleCode] ?? "⚠️"}
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg border ${acc.badge}`}>
                  {card.ruleCode}
                </span>
                <span className="text-sm font-semibold text-white truncate">{card.ruleName}</span>
                {card.isTriggered
                  ? <span className="text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-lg">⚡ Triggered</span>
                  : <span className="text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 px-2.5 py-0.5 rounded-lg">✓ OK</span>
                }
              </div>
              {/* Metric (shown inline on mobile) */}
              <div className="flex items-center gap-1.5 mt-1 sm:hidden text-xs">
                <span className={`font-bold tabular-nums ${card.isTriggered ? "text-rose-400" : "text-emerald-400"}`}>{metricFmt}</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-500">{thresholdFmt}</span>
              </div>
            </div>

            {/* Metric vs threshold — hidden on mobile (shown inline above) */}
            <div className="hidden sm:flex items-center gap-3 flex-shrink-0 text-sm">
              <span className={`text-lg font-bold tabular-nums ${card.isTriggered ? "text-rose-400" : "text-emerald-400"}`}>
                {metricFmt}
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{thresholdFmt}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-600"
              >
                {expanded ? "▲" : "▼"}
                <span className="hidden sm:inline"> {expanded ? "Less" : "Details"}</span>
              </button>
              {onDrillDown && card.isTriggered && (
                <button
                  onClick={() => onDrillDown(card.ruleCode)}
                  className="text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-2.5 sm:px-3 py-1.5 rounded-lg border border-indigo-500/40 transition-colors"
                >
                  <span className="hidden sm:inline">Evidence </span>→
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {card.metricValue !== null && (
            <div className="mt-3 mx-0">
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${card.isTriggered ? acc.bar : "bg-emerald-500"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Expanded */}
          {expanded && (
            <div className="mt-4 pt-4 border-t border-white/6 space-y-3">
              {card.affectedItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">
                    Affected items ({card.affectedCount})
                  </p>
                  <ul className="space-y-1">
                    {card.affectedItems.map((item, i) => (
                      <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-slate-600 mt-0.5 flex-shrink-0">•</span>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-3">
                <p className="text-xs font-semibold text-indigo-400 mb-1">💡 Suggested Action</p>
                <p className="text-sm text-slate-300 leading-relaxed">{card.suggestedAction}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
