import { useState } from "react";
import { briefApi, type AiBriefData, type BriefItem } from "../api/briefApi";
import { fetchReviewCIMetrics } from "../api/metricsApi";
import type { UC10MetricsResult } from "../types/metrics";
import { ErrorState } from "./ErrorState";
import { GhostBtn, PrimaryBtn } from "./PageShell";

type Period = { start: string; end: string };
type Metric = { label: string; value: number | null; unit: string; lowerIsBetter: boolean };
type ComparisonData = { earlier: AiBriefData; later: AiBriefData; earlierMetrics: UC10MetricsResult; laterMetrics: UC10MetricsResult };

const dateInput = (date: Date) => date.toISOString().split("T")[0];
const relativePeriod = (daysAgoStart: number, daysAgoEnd: number): Period => {
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - daysAgoStart);
  const end = new Date(now); end.setDate(end.getDate() - daysAgoEnd);
  return { start: dateInput(start), end: dateInput(end) };
};
const dateOnly = (value: string) => new Date(value).toISOString().slice(0, 10);
const sameRange = (brief: AiBriefData, period: Period) => dateOnly(brief.windowStart) === period.start && dateOnly(brief.windowEnd) === period.end;
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9\p{L}]+/gu, " ").trim();
const itemsOf = (brief: AiBriefData, type: string) => brief.items.filter(item => item.type === type);
const difference = (source: BriefItem[], other: BriefItem[]) => {
  const otherTitles = new Set(other.map(item => normalize(item.title)));
  return source.filter(item => !otherTitles.has(normalize(item.title)));
};
const metricsOf = (m: UC10MetricsResult): Metric[] => [
  { label: "Review pickup", value: m.reviewPickup.avgHours, unit: "h", lowerIsBetter: true },
  { label: "Review turnaround", value: m.reviewTurnaround.avgHours, unit: "h", lowerIsBetter: true },
  { label: "Reviewer concentration", value: m.reviewLoadConcentration.topReviewerPct, unit: "%", lowerIsBetter: true },
  { label: "Failed checks", value: m.failedCheckRate.failedRatePct, unit: "%", lowerIsBetter: true },
];
const formatValue = (value: number | null, unit: string) => value === null ? "No data" : `${value.toFixed(1)}${unit}`;
const formatPeriod = (period: Period) => `${new Date(`${period.start}T00:00:00`).toLocaleDateString()} – ${new Date(`${period.end}T00:00:00`).toLocaleDateString()}`;

function PeriodPicker({ title, value, onChange }: { title: string; value: Period; onChange: (period: Period) => void }) {
  return <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
    <legend className="px-2 text-sm font-bold text-slate-700">{title}</legend>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs font-medium text-slate-500">From<input type="date" value={value.start} max={value.end} onChange={e => onChange({ ...value, start: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" /></label>
      <label className="text-xs font-medium text-slate-500">To<input type="date" value={value.end} min={value.start} onChange={e => onChange({ ...value, end: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" /></label>
    </div>
  </fieldset>;
}

function BriefColumn({ label, brief, period }: { label: string; brief: AiBriefData; period: Period }) {
  const risks = itemsOf(brief, "risk_summary");
  const recommendations = itemsOf(brief, "recommendation");
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 border-b border-slate-100 pb-3"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{label}</p><h3 className="font-bold text-slate-900">{formatPeriod(period)}</h3><p className="text-xs text-slate-500">Confidence: {brief.confidence}</p></div>
    <h4 className="mb-2 text-sm font-bold text-slate-800">Executive Summary</h4><p className="mb-5 text-sm leading-relaxed text-slate-600">{brief.summary}</p>
    <h4 className="mb-2 text-sm font-bold text-slate-800">Risks ({risks.length})</h4><div className="mb-5 space-y-2">{risks.length ? risks.map((item, i) => <div key={`${item.title}-${i}`} className="rounded-lg bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-900">{item.title}</p><p className="text-xs text-amber-800">{item.detail}</p></div>) : <p className="text-sm italic text-slate-400">No risks recorded.</p>}</div>
    <h4 className="mb-2 text-sm font-bold text-slate-800">Recommendations ({recommendations.length})</h4><div className="space-y-2">{recommendations.length ? recommendations.map((item, i) => <div key={`${item.title}-${i}`} className="rounded-lg bg-emerald-50 p-3"><p className="text-sm font-semibold text-emerald-900">{item.title}</p><p className="text-xs text-emerald-800">{item.detail}</p></div>) : <p className="text-sm italic text-slate-400">No recommendations recorded.</p>}</div>
  </section>;
}

export function BriefComparisonView({ repositoryId, onClose }: { repositoryId: string; onClose: () => void }) {
  const [earlierPeriod, setEarlierPeriod] = useState<Period>(() => relativePeriod(14, 8));
  const [laterPeriod, setLaterPeriod] = useState<Period>(() => relativePeriod(7, 1));
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = async () => {
    if (!earlierPeriod.start || !earlierPeriod.end || !laterPeriod.start || !laterPeriod.end) return;
    if (earlierPeriod.start > earlierPeriod.end || laterPeriod.start > laterPeriod.end) {
      setError("The start date must be before the end date in both periods."); return;
    }
    if (earlierPeriod.start >= laterPeriod.start) {
      setError("Period A must start before Period B so progress can be evaluated chronologically."); return;
    }
    setLoading(true); setError(null);
    try {
      const [briefs, earlierMetrics, laterMetrics] = await Promise.all([
        briefApi.getBriefs(repositoryId),
        fetchReviewCIMetrics(repositoryId, 7, earlierPeriod.start, earlierPeriod.end),
        fetchReviewCIMetrics(repositoryId, 7, laterPeriod.start, laterPeriod.end),
      ]);
      const earlier = briefs.find(brief => sameRange(brief, earlierPeriod));
      const later = briefs.find(brief => sameRange(brief, laterPeriod));
      if (!earlier || !later) throw new Error("No saved Brief matches one or both periods. Generate each period in Weekly Brief first, then compare again.");
      setComparison({ earlier, later, earlierMetrics, laterMetrics });
    } catch (err) {
      setComparison(null); setError(err instanceof Error ? err.message : "Could not compare these periods.");
    } finally { setLoading(false); }
  };

  const earlierRisks = comparison ? itemsOf(comparison.earlier, "risk_summary") : [];
  const laterRisks = comparison ? itemsOf(comparison.later, "risk_summary") : [];
  const resolvedRisks = difference(earlierRisks, laterRisks);
  const newRisks = difference(laterRisks, earlierRisks);
  const earlierRecommendations = comparison ? itemsOf(comparison.earlier, "recommendation") : [];
  const laterRecommendations = comparison ? itemsOf(comparison.later, "recommendation") : [];
  const potentiallyEffective = resolvedRisks.length ? difference(earlierRecommendations, laterRecommendations) : [];

  return <div className="space-y-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 md:p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Brief Comparison</h2><p className="text-sm text-slate-500">Compare delivery health and actions between two saved reporting periods.</p></div><GhostBtn onClick={onClose}>Close</GhostBtn></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><PeriodPicker title="Period A · Earlier" value={earlierPeriod} onChange={period => { setEarlierPeriod(period); setComparison(null); }} /><PeriodPicker title="Period B · Later" value={laterPeriod} onChange={period => { setLaterPeriod(period); setComparison(null); }} /></div>
    <div className="flex justify-end"><PrimaryBtn onClick={compare} loading={loading} disabled={loading}>Compare periods</PrimaryBtn></div>
    {error && <ErrorState message={error} retryAction={compare} />}
    {comparison && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-bold text-slate-900">KPI movement</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{metricsOf(comparison.earlierMetrics).map((metric, index) => {
        const next = metricsOf(comparison.laterMetrics)[index];
        const delta = metric.value === null || next.value === null ? null : next.value - metric.value;
        const improved = delta !== null && delta !== 0 && (metric.lowerIsBetter ? delta < 0 : delta > 0);
        return <div key={metric.label} className={`rounded-xl border p-4 ${delta === null || delta === 0 ? "border-slate-200 bg-slate-50" : improved ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><p className="text-xs font-bold uppercase text-slate-500">{metric.label}</p><p className="mt-1 text-lg font-bold text-slate-900">{formatValue(metric.value, metric.unit)} → {formatValue(next.value, next.unit)}</p><p className={`text-sm font-semibold ${improved ? "text-emerald-700" : delta === null || delta === 0 ? "text-slate-500" : "text-rose-700"}`}>{delta === null ? "— Insufficient data" : delta === 0 ? "→ No change" : `${delta > 0 ? "📈" : "📉"} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}${metric.unit} · ${improved ? "Improved" : "Needs attention"}`}</p></div>;
      })}</div></section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><h3 className="font-bold text-rose-900">New risks ({newRisks.length})</h3>{newRisks.length ? newRisks.map((r,i)=><p key={`${r.title}-${i}`} className="mt-2 text-sm text-rose-800">+ {r.title}</p>) : <p className="mt-2 text-sm text-rose-700">No new risks.</p>}</div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold text-emerald-900">Resolved risks ({resolvedRisks.length})</h3>{resolvedRisks.length ? resolvedRisks.map((r,i)=><p key={`${r.title}-${i}`} className="mt-2 text-sm text-emerald-800">✓ {r.title}</p>) : <p className="mt-2 text-sm text-emerald-700">No resolved risks detected.</p>}</div><div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="font-bold text-blue-900">Potentially effective actions ({potentiallyEffective.length})</h3>{potentiallyEffective.length ? potentiallyEffective.map((r,i)=><p key={`${r.title}-${i}`} className="mt-2 text-sm text-blue-800">✓ {r.title}</p>) : <p className="mt-2 text-sm text-blue-700">No effectiveness signal yet.</p>}<p className="mt-3 text-xs text-blue-600">Inference: an earlier recommendation stopped recurring while at least one risk was resolved. This does not prove causality.</p></div></section>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><BriefColumn label="Period A" brief={comparison.earlier} period={earlierPeriod} /><BriefColumn label="Period B" brief={comparison.later} period={laterPeriod} /></div>
    </>}
  </div>;
}
