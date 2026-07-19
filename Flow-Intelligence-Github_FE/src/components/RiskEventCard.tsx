import { useState } from "react";
import { Link } from "react-router-dom";
import type { RiskEvent, EvidenceItem } from "../types/risk.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export const RULE_ICONS: Record<string, string> = {
  R1: "⏳", R2: "⏱️", R3: "👤", R4: "🔴", R5: "📦",
};

export const RULE_NAMES: Record<string, string> = {
  R1: "Stale PRs",
  R2: "Slow Review Pickup",
  R3: "Reviewer Concentration",
  R4: "CI Friction",
  R5: "Oversized PRs",
};

export const RULE_ACCENT: Record<string, { bar: string; code: string; border: string; bg: string }> = {
  R1: { bar: "bg-rose-500",   code: "bg-rose-50 text-rose-700 border-rose-200/60",       border: "border-rose-200",   bg: "bg-rose-50/50"   },
  R2: { bar: "bg-amber-500",  code: "bg-amber-50 text-amber-700 border-amber-200/60",     border: "border-amber-200",  bg: "bg-amber-50/50"  },
  R3: { bar: "bg-amber-500",  code: "bg-amber-50 text-amber-700 border-amber-200/60",     border: "border-amber-200",  bg: "bg-amber-50/50"  },
  R4: { bar: "bg-rose-500",   code: "bg-rose-50 text-rose-700 border-rose-200/60",       border: "border-rose-200",   bg: "bg-rose-50/50"   },
  R5: { bar: "bg-orange-500", code: "bg-orange-50 text-orange-700 border-orange-200/60", border: "border-orange-200", bg: "bg-orange-50/50" },
};

// ─── Evidence item row ────────────────────────────────────────────────────────
export interface EvidenceItemRowProps {
  item: EvidenceItem;
}

export function EvidenceItemRow({ item }: EvidenceItemRowProps) {
  const ENTITY_ICONS: Record<string, string> = {
    pull_request: "🔀", review: "📝", check_run: "🔴", contributor: "👤", other: "📌",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">{ENTITY_ICONS[item.entityType] ?? "📌"}</span>
          <p className="text-sm font-semibold text-slate-800 truncate">{item.label}</p>
        </div>
        {item.githubUrl && (
          <a href={item.githubUrl} target="_blank" rel="noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-500 border border-indigo-200 bg-indigo-50/50 px-2 py-0.5 rounded-lg transition-colors flex-shrink-0 font-medium">
            View ↗
          </a>
        )}
      </div>
      {/* Per-item reasoning: why this record is evidence for the rule. */}
      {item.summary && item.summary !== item.label && (
        <p className="mt-1.5 pl-8 text-xs text-slate-500">{item.summary}</p>
      )}
    </div>
  );
}

// ─── Risk event card ──────────────────────────────────────────────────────────

export function RiskEventCard({ event, dimmed = false, repositoryId }: { event: RiskEvent; dimmed?: boolean; repositoryId?: string }) {
  const [open, setOpen] = useState(false);
  const acc = RULE_ACCENT[event.ruleCode] ?? RULE_ACCENT.R1;
  const icon = RULE_ICONS[event.ruleCode] ?? "⚠️";
  const triggered = event.status === "active";

  const fmtMetric = (v: number | null | undefined, u: string) =>
    v == null ? "—" : `${v % 1 === 0 ? v : v.toFixed(1)} ${u}`;

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm transition-all ${
      dimmed ? "border-slate-200 bg-slate-50/50 opacity-70 hover:opacity-100" : `${acc.border} ${acc.bg}`
    }`}>
      <div className="flex">
        <div className={`w-1.5 flex-shrink-0 ${triggered ? acc.bar : "bg-slate-300"}`} />
        <div className="flex-1">
          {/* Main row */}
          <div className="flex items-center gap-4 p-5">
            {/* Icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
              triggered ? "bg-white border border-slate-100 shadow-sm" : "bg-slate-100"
            }`}>
              {icon}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg border ${acc.code}`}>
                  {event.ruleCode}
                </span>
                <span className="text-base font-bold text-slate-800">
                  {RULE_NAMES[event.ruleCode] ?? event.ruleCode}
                </span>
              </div>
              {/* Metric vs threshold */}
              {event.metricValue != null && (
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-bold tabular-nums ${triggered ? "text-rose-600" : "text-emerald-600"}`}>
                    {fmtMetric(event.metricValue, event.thresholdUnit)}
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-500">threshold {fmtMetric(event.thresholdValue, event.thresholdUnit)}</span>
                </div>
              )}
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {triggered
                ? <span className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/65 px-3 py-1.5 rounded-xl">⚡ Triggered</span>
                : <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/65 px-3 py-1.5 rounded-xl">✓ OK</span>
              }

              {/* Evidence toggle */}
              {event.evidenceCard && event.evidenceCard.evidence.length > 0 && (
                <button
                  onClick={() => setOpen((v) => !v)}
                  className="text-xs border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl transition-colors font-medium shadow-sm"
                >
                  {open ? "▲ Hide" : `▼ Evidence (${event.evidenceCard.evidence.length})`}
                </button>
              )}
            </div>
          </div>

          {/* Recommendations summary (collapsed, just text) */}
          {triggered && event.evidenceCard?.suggestedAction && !open && (
            <div className="px-5 pb-4 border-t border-slate-100/50 pt-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-slate-700 font-semibold">Suggested: </span>
                {event.evidenceCard.suggestedAction}
              </p>
            </div>
          )}

          {/* Evidence expanded */}
          {open && event.evidenceCard && (
            <div className="border-t border-slate-100 p-5 space-y-4 bg-white/60">
              <div>
                <p className="text-sm font-semibold text-slate-900">{event.evidenceCard.title}</p>
                <p className="text-xs text-slate-500 mt-1">{event.evidenceCard.summary}</p>
              </div>

              <p className="text-xs font-bold text-slate-600 flex items-center gap-2">
                🔍 Evidence Items
                <span className="text-slate-400 font-normal">— items that triggered this rule</span>
              </p>

              <div className="space-y-2">
                {event.evidenceCard.evidence.map((item) => (
                  <EvidenceItemRow key={item.entityId} item={item} />
                ))}
              </div>

              {event.evidenceCard.limitation && (
                <p className="text-xs text-slate-400 italic mt-2">
                  ⚠️ Limitation: {event.evidenceCard.limitation}
                </p>
              )}

              {event.evidenceCard.suggestedAction && (
                <div className="rounded-xl bg-indigo-50/50 border border-indigo-100/60 px-4 py-3 mt-3">
                  <p className="text-xs font-semibold text-indigo-700 mb-1">💡 Suggested Action</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{event.evidenceCard.suggestedAction}</p>
                </div>
              )}

              {repositoryId && event.evidenceCard.id && (
                <Link
                  to={`/repositories/${repositoryId}/evidence/${event.evidenceCard.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-1"
                >
                  View full evidence card →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
