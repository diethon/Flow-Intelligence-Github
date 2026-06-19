import { useState, useEffect } from "react";
import type { RulebookEntry, RulebookRecommendation } from "../types/dashboard.js";
import { fetchRulebook } from "../api/dashboardApi.js";
import { PageShell, SectionHeading, ErrorAlert } from "../components/PageShell.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const RULE_ICONS: Record<string, string> = {
  R1: "⏳", R2: "⏱️", R3: "👤", R4: "🔴", R5: "📦",
};

const RULE_ACCENT: Record<string, { bar: string; code: string; border: string; bg: string; glow: string }> = {
  R1: { bar: "bg-rose-500",    code: "bg-rose-500/20 text-rose-300 border-rose-500/40",       border: "border-rose-500/25",    bg: "bg-rose-500/5",    glow: "shadow-rose-900/20"    },
  R2: { bar: "bg-amber-500",   code: "bg-amber-500/20 text-amber-300 border-amber-500/40",     border: "border-amber-500/25",   bg: "bg-amber-500/5",   glow: "shadow-amber-900/20"   },
  R3: { bar: "bg-amber-500",   code: "bg-amber-500/20 text-amber-300 border-amber-500/40",     border: "border-amber-500/25",   bg: "bg-amber-500/5",   glow: "shadow-amber-900/20"   },
  R4: { bar: "bg-rose-500",    code: "bg-rose-500/20 text-rose-300 border-rose-500/40",       border: "border-rose-500/25",    bg: "bg-rose-500/5",    glow: "shadow-rose-900/20"    },
  R5: { bar: "bg-orange-500",  code: "bg-orange-500/20 text-orange-300 border-orange-500/40", border: "border-orange-500/25",  bg: "bg-orange-500/5",  glow: "shadow-orange-900/20"  },
};

const EVIDENCE_LABELS: Record<string, string> = {
  stale_pr: "Stale Pull Request", review_pickup: "Review Pickup Delay",
  reviewer_concentration: "Reviewer Concentration", ci_friction: "CI Pipeline Friction",
  oversized_pr: "Oversized Pull Request",
};

const CATEGORY_CFG: Record<string, { icon: string; label: string; cls: string }> = {
  process:       { icon: "⚙️", label: "Process",       cls: "bg-blue-500/15 text-blue-300 border-blue-500/30"      },
  tooling:       { icon: "🔧", label: "Tooling",       cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  communication: { icon: "💬", label: "Communication", cls: "bg-teal-500/15 text-teal-300 border-teal-500/30"        },
  visibility:    { icon: "👁️", label: "Visibility",    cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"        },
};

// ─── Recommendation item ──────────────────────────────────────────────────────

function RecommendationItem({ rec }: { rec: RulebookRecommendation }) {
  const cat = CATEGORY_CFG[rec.category] ?? CATEGORY_CFG.process;
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <p className="text-sm font-semibold text-white leading-snug">{rec.title}</p>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${cat.cls}`}>
          {cat.icon} {cat.label}
        </span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{rec.description}</p>
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
    <div className={`rounded-2xl border overflow-hidden shadow-lg ${acc.border} ${acc.bg} ${acc.glow}`}>
      <div className="flex">
        {/* Left bar */}
        <div className={`w-1.5 flex-shrink-0 ${acc.bar}`} />

        <div className="flex-1">
          {/* Header */}
          <div className="p-6">
            <div className="flex items-start gap-4 mb-5">
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-2xl flex-shrink-0">
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
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}>
                    {rule.severity.toUpperCase()}
                  </span>
                  {!rule.isActive && (
                    <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-lg">Inactive</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{rule.name}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{rule.description}</p>
              </div>
            </div>

            {/* Info chips */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1.5">Trigger Condition</p>
                <p className="text-sm font-semibold text-slate-200 leading-snug">{triggerText}</p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1.5">Evidence Type</p>
                <p className="text-sm font-semibold text-slate-200">{EVIDENCE_LABELS[rule.evidenceType] ?? rule.evidenceType}</p>
              </div>
            </div>
          </div>

          {/* Recommendations toggle */}
          {rule.recommendations.length > 0 && (
            <div className="border-t border-white/5">
              <button
                onClick={() => setRecsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">💡</span>
                  <span className="text-sm font-semibold text-slate-300">
                    Recommended Actions
                    <span className="ml-2 text-slate-500 font-normal">({rule.recommendations.length})</span>
                  </span>
                </div>
                <span className="text-sm text-slate-500">{recsOpen ? "▲ Hide" : "▼ Show"}</span>
              </button>

              {recsOpen && (
                <div className="px-6 pb-6 space-y-3">
                  {rule.recommendations.map((rec) => (
                    <RecommendationItem key={rec.actionCode} rec={rec} />
                  ))}
                  <p className="text-xs text-slate-600 italic pt-1">
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
        { label: "Total Rules",     value: rules.length,                                      color: "text-indigo-400"   },
        { label: "High Severity",   value: rules.filter((r) => r.severity === "high").length,   color: "text-rose-400"     },
        { label: "Medium Severity", value: rules.filter((r) => r.severity === "medium").length, color: "text-amber-400"    },
        { label: "Active",          value: rules.filter((r) => r.isActive).length,             color: "text-emerald-400"  },
      ].map((s) => (
        <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-center">
          <div className={`text-3xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
          <div className="text-sm text-slate-500 mt-1">{s.label}</div>
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
      .catch(() => setError("Could not load rulebook. Make sure backend is running and rulebook is seeded."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? rules : rules.filter((r) => r.severity === filter);

  return (
    <PageShell
      title="Flow Risk Rulebook"
      subtitle="R1–R5 delivery flow risk rules"
      actions={
        rules.length > 0 ? (
          <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
            {(["all", "high", "medium"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  filter === f ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  filter === f ? "bg-white/20" : "bg-slate-700 text-slate-500"
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
        <ErrorAlert message={`${error} — Seed first via POST /api/seed/rulebook or the Dashboard Seed button.`} />
      )}

      {/* Intro */}
      {!loading && !error && rules.length > 0 && (
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl flex-shrink-0">
              📋
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">About the Flow Risk Rulebook</h2>
              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
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
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-48 rounded-2xl bg-slate-900/60 animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rules.length === 0 && (
        <div className="text-center py-24 text-slate-600">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-base">No rules found. Seed via POST /api/seed/rulebook.</p>
        </div>
      )}

      {/* Rule cards — 2 column grid */}
      {!loading && filtered.length > 0 && (
        <section>
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
          <p className="text-sm font-semibold text-slate-400 mb-1">Privacy & Prohibited-Use Notice</p>
          <p className="text-sm text-slate-500 leading-relaxed">
            Flow Risk rules evaluate team-level workflow patterns only. No individual productivity score,
            burnout diagnosis, HR recommendation, or performance ranking is produced.
          </p>
        </div>
      )}
    </PageShell>
  );
}
