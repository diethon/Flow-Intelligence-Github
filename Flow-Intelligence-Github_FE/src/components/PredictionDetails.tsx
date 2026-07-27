import React from "react";
import type { PredictionResult } from "./PredictionCard";

export interface PredictionDetailsProps {
  prediction: PredictionResult;
}

export function PredictionDetails({ prediction }: PredictionDetailsProps) {
  const features = prediction.featureSummary || {};
  
  const featureList = [
    { key: "changed_files", label: "Changed Files", icon: "📄" },
    { key: "additions", label: "Lines Added", icon: "➕", color: "text-emerald-600" },
    { key: "deletions", label: "Lines Deleted", icon: "➖", color: "text-rose-600" },
    { key: "commits", label: "Commits", icon: "🔄" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span>🤖</span> ML Prediction Details
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {featureList.map(({ key, label, icon, color }) => {
          const val = features[key];
          return (
            <div key={key} className="bg-slate-50 rounded-xl p-4 border border-slate-100/50">
              <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                <span>{icon}</span>
                {label}
              </div>
              <div className={`text-xl font-bold tabular-nums ${color || "text-slate-700"}`}>
                {val !== undefined ? val : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Probabilities Breakdown */}
      {prediction.probabilities && (() => {
        let low = prediction.probabilities.low ?? prediction.probabilities.Low ?? 0;
        let med = prediction.probabilities.medium ?? prediction.probabilities.Medium ?? 0;
        let high = prediction.probabilities.high ?? prediction.probabilities.High ?? 0;
        const tot = low + med + high;
        if (tot > 0) { low /= tot; med /= tot; high /= tot; }
        const lVal = Math.round(low * 1000) / 10;
        const mVal = Math.round(med * 1000) / 10;
        const hVal = Math.round((100 - lVal - mVal) * 10) / 10;

        return (
          <div className="mb-6 bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wider">
              Risk Probability Breakdown
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-emerald-200 rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-emerald-700">Low Risk</div>
                <div className="text-lg font-black text-emerald-800 tabular-nums">
                  {lVal.toFixed(1)}%
                </div>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-amber-700">Medium Risk</div>
                <div className="text-lg font-black text-amber-800 tabular-nums">
                  {mVal.toFixed(1)}%
                </div>
              </div>
              <div className="bg-white border border-rose-200 rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-rose-700">High Risk</div>
                <div className="text-lg font-black text-rose-800 tabular-nums">
                  {hVal.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-indigo-700 mb-2 uppercase tracking-wider">Model Information</p>
        <div className="flex flex-col gap-1 text-sm text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-500">Model Version:</span>
            <span className="font-mono text-xs font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
              {prediction.modelVersionId || "baseline-rf-v1"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Computed At:</span>
            <span>{new Date(prediction.predictedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
