import { useState, useEffect } from "react";
import type { RulebookEntry, RulebookRecommendation } from "../types/dashboard.js";
import { fetchRulebook } from "../api/dashboardApi.js";
import { PageShell, SectionHeading, ErrorAlert } from "../components/PageShell.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const RULE_ICONS: Record<string, string> = {
  R1: "⏳", R2: "⏱️", R3: "👤", R4: "🔴", R5: "📦",
};

const RULE_ACCENT: Record<string, { bar: string; code: string; border: string; bg: string; glow: string }> = {
  R1: { bar: "bg-rose-500",    code: "bg-rose-50 text-rose-700 border-rose-200/60",       border: "border-rose-200",    bg: "bg-rose-50/50",    glow: "shadow-rose-100/10"    },
  R2: { bar: "bg-amber-500",   code: "bg-amber-50 text-amber-700 border-amber-200/60",     border: "border-amber-200",   bg: "bg-amber-50/50",   glow: "shadow-amber-100/10"   },
  R3: { bar: "bg-amber-500",   code: "bg-amber-50 text-amber-700 border-amber-200/60",     border: "border-amber-200",   bg: "bg-amber-50/50",   glow: "shadow-amber-100/10"   },
  R4: { bar: "bg-rose-500",    code: "bg-rose-50 text-rose-700 border-rose-200/60",       border: "border-rose-200",    bg: "bg-rose-50/50",    glow: "shadow-rose-100/10"    },
  R5: { bar: "bg-orange-500",  code: "bg-orange-50 text-orange-700 border-orange-200/60", border: "border-orange-200",  bg: "bg-orange-50/50",  glow: "shadow-orange-100/10"  },
};

const EVIDENCE_LABELS: Record<string, string> = {
  stale_pr: "Stale Pull Request", review_pickup: "Review Pickup Delay",
  reviewer_concentration: "Reviewer Concentration", ci_friction: "CI Pipeline Friction",
  oversized_pr: "Oversized Pull Request",
};

const CATEGORY_CFG: Record<string, { icon: string; label: string; cls: string }> = {
  process:       { icon: "⚙️", label: "Process",       cls: "bg-blue-50 text-blue-700 border-blue-200/60"      },
  tooling:       { icon: "🔧", label: "Tooling",       cls: "bg-violet-50 text-violet-700 border-violet-200/60" },
  communication: { icon: "💬", label: "Communication", cls: "bg-teal-50 text-teal-700 border-teal-200/60"        },
  visibility:    { icon: "👁️", label: "Visibility",    cls: "bg-cyan-50 text-cyan-700 border-cyan-200/60"        },
};

// ─── Recommendation item ──────────────────────────────────────────────────────

function RecommendationItem({ rec }: { rec: RulebookRecommendation }) {
  const cat = CATEGORY_CFG[rec.category] ?? CATEGORY_CFG.process;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{rec.title}</p>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${cat.cls}`}>
          {cat.icon} {cat.label}
        </span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{rec.description}</p>
    </div>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({ rule }: { rule: RulebookEntry }) {
  const [recsOpen, setRecsOpen] = useState(false);
  const acc = RULE_ACCENT[rule.ruleCode] ?? RULE_ACCENT.R1;

  const thresholdFmt =
    rule.thresholdUnit === "%" ? `${rule.threshold}%`
    : rule.thresholdUnit === "hours" ? `${rule.threshold} hrs`
    : `${rule.threshold} ${rule.thresholdUnit}`;

  const triggerText =
    rule.operator === "gte"
      ? `Triggers when metric ≥ ${thresholdFmt}`
      : `Triggers when metric ≤ ${thresholdFmt}`;

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm bg-white ${acc.border} ${acc.bg} ${acc.glow}`}>
      <div className="flex">
        {/* Left bar */}
        <div className={`w-1.5 flex-shrink-0 ${acc.bar}`} />

        <div className="flex-1">
          {/* Header */}
          <div className="p-6">
            <div className="flex items-start gap-4 mb-5">
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0 border border-slate-200/50 shadow-sm">
                {RULE_ICONS[rule.ruleCode] ?? "⚠️"}
              </div>
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2.5 flex-wrap mb-2">
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg border ${acc.code}`}>
                    {rule.ruleCode}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                    rule.severity === "high"
                      ? "bg-rose-55 text-rose-700 border-rose-200"
                      : "bg-amber-55 text-amber-700 border-amber-200"
                  }`}>
                    {rule.severity.toUpperCase()}
                  </span>
                  {!rule.isActive && (
                    <span className="text-xs bg-slate-100 text-slate-400 border border-slate-200 px-2 py-0.5 rounded-lg font-semibold">Inactive</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{rule.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{rule.description}</p>
              </div>
            </div>

            {/* Info chips */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200/65 px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Trigger Condition</p>
                <p className="text-xs font-bold text-slate-700 leading-snug">{triggerText}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200/65 px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Evidence Type</p>
                <p className="text-xs font-bold text-slate-700">{EVIDENCE_LABELS[rule.evidenceType] ?? rule.evidenceType}</p>
              </div>
            </div>
          </div>

          {/* Recommendations toggle */}
          {rule.recommendations.length > 0 && (
            <div className="border-t border-slate-100">
              <button
                onClick={() => setRecsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">💡</span>
                  <span className="text-sm font-bold text-slate-750">
                    Recommended Actions
                    <span className="ml-2 text-slate-400 font-normal">({rule.recommendations.length})</span>
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-400">{recsOpen ? "▲ Hide" : "▼ Show"}</span>
              </button>

              {recsOpen && (
                <div className="px-6 pb-6 space-y-3 bg-white/40 pt-2 border-t border-slate-50">
                  {rule.recommendations.map((rec) => (
                    <RecommendationItem key={rec.actionCode} rec={rec} />
                  ))}
                  <p className="text-[10px] text-slate-400 italic pt-1">
                    All recommendations are safe workflow improvements. No HR language or individual scoring.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ rules }: { rules: RulebookEntry[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: "Total Rules",     value: rules.length,                                      color: "text-indigo-600"   },
        { label: "High Severity",   value: rules.filter((r) => r.severity === "high").length,   color: "text-rose-600"     },
        { label: "Medium Severity", value: rules.filter((r) => r.severity === "medium").length, color: "text-amber-600"    },
        { label: "Active",          value: rules.filter((r) => r.isActive).length,             color: "text-emerald-600"  },
      ].map((s) => (
        <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
          <div className={`text-3xl font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
          <div className="text-xs text-slate-400 uppercase font-bold tracking-wide mt-1.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type Filter = "all" | "high" | "medium";

// ─── Main page ────────────────────────────────────────────────────────────────

export function RulebookPage() {
  const [rules, setRules]     = useState<RulebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<Filter>("all");

  useEffect(() => {
    fetchRulebook()
      .then(setRules)
      .catch(() => setError("Could not load rulebook. Make sure backend is running."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? rules : rules.filter((r) => r.severity === filter);

  return (
    <PageShell
      title="Flow Risk Rulebook"
      subtitle="R1–R5 delivery flow risk rules"
      actions={
        rules.length > 0 ? (
          <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 shadow-sm">
            {(["all", "high", "medium"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  filter === f ? "bg-white text-indigo-600 border border-slate-200/60 shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  filter === f ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-400"
                }`}>
                  {f === "all" ? rules.length : rules.filter((r) => r.severity === f).length}
                </span>
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {error && (
        <ErrorAlert message={error} />
      )}

      {/* Intro */}
      {!loading && !error && rules.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/50 via-indigo-50/10 to-transparent p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
              📋
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">About the Flow Risk Rulebook</h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                5 explainable rules (R1–R5) that evaluate GitHub workflow health. Each has a measurable
                trigger condition, a threshold, and safe workflow recommendations — no individual
                productivity scoring or HR language.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && rules.length > 0 && <StatsBar rules={rules} />}

      {/* Loading */}
      {loading && (
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rules.length === 0 && (
        <div className="text-center py-24 text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-base font-semibold">No rules found. Make sure backend is running.</p>
        </div>
      )}

      {/* Rule cards — 2 column grid */}
      {!loading && filtered.length > 0 && (
        <section className="space-y-4">
          <SectionHeading
            title={filter === "all" ? "All Rules" : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Severity Rules`}
            subtitle={`${filtered.length} rule${filtered.length !== 1 ? "s" : ""}`}
          />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filtered.map((rule) => <RuleCard key={rule.ruleCode} rule={rule} />)}
          </div>
        </section>
      )}

      {/* Privacy notice */}
      {!loading && rules.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-100/40 px-5 py-4">
          <p className="text-xs font-bold text-slate-500 mb-1">Privacy & Prohibited-Use Notice</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Flow Risk rules evaluate team-level workflow patterns only. No individual productivity score,
            burnout diagnosis, HR recommendation, or performance ranking is produced.
          </p>
        </div>
      )}
    </PageShell>
  );
}

export default RulebookPage;
