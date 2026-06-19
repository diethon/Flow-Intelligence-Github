import type { RiskLevel } from "../types/dashboard.js";

const RISK_CONFIG: Record<RiskLevel, { label: string; bg: string; text: string; border: string; dot: string }> = {
  high:   { label: "High Risk",   bg: "bg-rose-500/20",    text: "text-rose-300",    border: "border-rose-500/50",    dot: "bg-rose-400"     },
  medium: { label: "Medium Risk", bg: "bg-amber-500/20",   text: "text-amber-300",   border: "border-amber-500/50",   dot: "bg-amber-400"    },
  low:    { label: "Low Risk",    bg: "bg-yellow-500/20",  text: "text-yellow-300",  border: "border-yellow-500/50",  dot: "bg-yellow-400"   },
  good:   { label: "Healthy",     bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/50", dot: "bg-emerald-400"  },
};

interface RiskBadgeProps {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ level, size = "md" }: RiskBadgeProps) {
  const c = RISK_CONFIG[level];
  const cls =
    size === "lg" ? "px-4 py-2 text-sm font-bold gap-2 rounded-xl" :
    size === "sm" ? "px-2.5 py-1 text-xs font-semibold gap-1.5 rounded-lg" :
                   "px-3 py-1.5 text-xs font-semibold gap-1.5 rounded-lg";
  return (
    <span className={`inline-flex items-center border font-semibold ${c.bg} ${c.text} ${c.border} ${cls}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} animate-pulse flex-shrink-0`} />
      {c.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const map = {
    high:   "bg-rose-500/20 text-rose-300 border border-rose-500/40",
    medium: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    low:    "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wide ${map[severity]}`}>
      {severity}
    </span>
  );
}
