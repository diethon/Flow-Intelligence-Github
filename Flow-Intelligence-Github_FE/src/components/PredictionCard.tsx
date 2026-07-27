import React from "react";

export interface PredictionResult {
  pullRequestId: string;
  modelVersionId: string;
  probability: number;
  riskLabel: "Low" | "Medium" | "High";
  featureSummary: Record<string, number | string | boolean>;
  probabilities?: Record<string, number>;
  topFactors?: any[];
  predictedAt: string;
}

export interface PredictionCardProps {
  prediction: PredictionResult;
  prNumber?: number;
  prTitle?: string;
  onClick?: () => void;
}

const RISK_THEME = {
  Low: { border: "border-emerald-200", bg: "bg-emerald-50/50", text: "text-emerald-700", badgeBg: "bg-emerald-50", badgeBorder: "border-emerald-200/60", icon: "✅" },
  Medium: { border: "border-amber-200", bg: "bg-amber-50/50", text: "text-amber-700", badgeBg: "bg-amber-50", badgeBorder: "border-amber-200/60", icon: "⚠️" },
  High: { border: "border-rose-200", bg: "bg-rose-50/50", text: "text-rose-700", badgeBg: "bg-rose-50", badgeBorder: "border-rose-200/60", icon: "🔴" }
};

export function PredictionCard({ prediction, prNumber, prTitle, onClick }: PredictionCardProps) {
  const theme = RISK_THEME[prediction.riskLabel] || RISK_THEME.Low;

  const rawProbs = prediction.probabilities;
  let lowProb = rawProbs?.low ?? rawProbs?.Low;
  let medProb = rawProbs?.medium ?? rawProbs?.Medium;
  let highProb = rawProbs?.high ?? rawProbs?.High;

  if (lowProb === undefined || medProb === undefined || highProb === undefined) {
    const top = Math.max(0.34, Math.min(0.99, prediction.probability));
    const rem = 1 - top;
    if (prediction.riskLabel === "High") {
      highProb = top;
      medProb = rem * 0.7;
      lowProb = rem * 0.3;
    } else if (prediction.riskLabel === "Medium") {
      medProb = top;
      lowProb = rem * 0.6;
      highProb = rem * 0.4;
    } else {
      lowProb = top;
      medProb = rem * 0.7;
      highProb = rem * 0.3;
    }
  }

  // Normalize to 1.0
  const total = lowProb + medProb + highProb;
  if (total > 0) {
    lowProb /= total;
    medProb /= total;
    highProb /= total;
  }

  // Round percentages ensuring sum is exactly 100.0%
  const lowVal = Math.round(lowProb * 1000) / 10;
  const medVal = Math.round(medProb * 1000) / 10;
  const highVal = Math.round((100 - lowVal - medVal) * 10) / 10;

  const lowPct = lowVal.toFixed(1);
  const medPct = medVal.toFixed(1);
  const highPct = highVal.toFixed(1);

  return (
    <div 
      onClick={onClick}
      className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${theme.border} ${theme.bg}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-white shadow-sm border border-slate-100`}>
            {theme.icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 line-clamp-1">
              {prTitle || "Unknown Pull Request"}
            </h3>
            {prNumber && <span className="text-xs text-slate-500 font-mono">#{prNumber}</span>}
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold ${theme.badgeBg} ${theme.text} ${theme.badgeBorder}`}>
          {prediction.riskLabel} Risk
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delay Risk Breakdown</span>
          <span className={`text-xs font-bold ${theme.text}`}>Top: {prediction.riskLabel}</span>
        </div>

        {/* 3 Percentages Display */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/80 backdrop-blur-sm border border-emerald-200/60 rounded-xl p-2 text-center shadow-2xs">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Low</div>
            <div className="text-sm font-black text-emerald-800 tabular-nums">{lowPct}%</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-amber-200/60 rounded-xl p-2 text-center shadow-2xs">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Medium</div>
            <div className="text-sm font-black text-amber-800 tabular-nums">{medPct}%</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-rose-200/60 rounded-xl p-2 text-center shadow-2xs">
            <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">High</div>
            <div className="text-sm font-black text-rose-800 tabular-nums">{highPct}%</div>
          </div>
        </div>

        {/* Segmented Bar */}
        <div className="h-2.5 w-full bg-white rounded-full overflow-hidden flex border border-slate-200/70 p-0.5">
          <div 
            style={{ width: `${lowPct}%` }} 
            className="h-full bg-emerald-500 rounded-l-full transition-all duration-700" 
            title={`Low Risk: ${lowPct}%`} 
          />
          <div 
            style={{ width: `${medPct}%` }} 
            className="h-full bg-amber-500 transition-all duration-700" 
            title={`Medium Risk: ${medPct}%`} 
          />
          <div 
            style={{ width: `${highPct}%` }} 
            className="h-full bg-rose-500 rounded-r-full transition-all duration-700" 
            title={`High Risk: ${highPct}%`} 
          />
        </div>
      </div>
      
      <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-200/50">
        Predicted {new Date(prediction.predictedAt).toLocaleDateString()}
      </p>
    </div>
  );
}

