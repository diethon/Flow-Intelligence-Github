import React from 'react';
import type { RiskDriver } from '../types';

interface RiskDriversProps {
  driver: RiskDriver;
}

/** Format a metric/threshold value using the rule's unit. */
const formatValue = (value: number, unit: string): string => {
  const u = unit.toLowerCase();
  if (u === 'pct' || u === '%' || u === 'percent') return `${Math.round(value * 10) / 10}%`;
  if (u === 'hours' || u === 'hrs' || u === 'h') return `${Math.round(value * 10) / 10}h`;
  if (u === 'days' || u === 'd') return `${Math.round(value * 10) / 10}d`;
  if (u === 'lines') return `${Math.round(value)} lines`;
  return String(Math.round(value * 10) / 10);
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  suppressed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

/**
 * Risk Drivers block for rule-based Evidence Cards — explains *why* a rule
 * triggered: the measured metric vs its threshold, the evaluation window, and
 * the event status. Symmetric to PredictionDetails for ML cards (CLAUDE.md §7.5).
 */
export const RiskDrivers: React.FC<RiskDriversProps> = ({ driver }) => {
  const { metricValue, thresholdValue, thresholdUnit, operator } = driver;

  // Over-threshold ratio for the bar (gte: how far above; lte: how far below).
  const exceeds = operator === 'gte' ? metricValue >= thresholdValue : metricValue <= thresholdValue;
  const denom = Math.max(metricValue, thresholdValue) || 1;
  const metricPct = Math.min(100, Math.round((metricValue / denom) * 100));
  const thresholdPct = Math.min(100, Math.round((thresholdValue / denom) * 100));

  const comparator = operator === 'gte' ? '≥' : '≤';
  const statusStyle = STATUS_STYLE[driver.status] ?? STATUS_STYLE.suppressed;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3 8 4-16 3 8h4" />
          </svg>
          Risk drivers
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
          {driver.ruleCode}
          <span className="font-sans font-normal text-slate-500">{driver.ruleName}</span>
        </span>
      </div>

      {/* Metric vs threshold */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Measured</p>
            <p className={`mt-0.5 text-2xl font-bold tabular-nums ${exceeds ? 'text-rose-600' : 'text-slate-700'}`}>
              {formatValue(metricValue, thresholdUnit)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Threshold {comparator}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-500">
              {formatValue(thresholdValue, thresholdUnit)}
            </p>
          </div>
        </div>

        {/* Bar: measured value with a threshold marker */}
        <div className="relative mt-3 h-2.5 w-full rounded-full bg-slate-200">
          <div
            className={`h-2.5 rounded-full ${exceeds ? 'bg-rose-500' : 'bg-sky-500'}`}
            style={{ width: `${metricPct}%` }}
          />
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-slate-500"
            style={{ left: `${thresholdPct}%` }}
            title={`Threshold: ${formatValue(thresholdValue, thresholdUnit)}`}
            aria-hidden
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {exceeds
            ? `Metric crossed the ${comparator} ${formatValue(thresholdValue, thresholdUnit)} threshold.`
            : `Metric is within the ${comparator} ${formatValue(thresholdValue, thresholdUnit)} threshold.`}
        </p>
      </div>

      {/* Window + status */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Window</p>
          <p className="mt-1 text-sm text-slate-700">
            {fmtDate(driver.windowStart)} – {fmtDate(driver.windowEnd)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
          <span className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${statusStyle}`}>
            {driver.status}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RiskDrivers;
