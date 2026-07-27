

export interface PredictionResult {
  pullRequestId: string;
  modelVersionId: string;
  probability: number;
  riskLabel: "Low" | "Medium" | "High";
  featureSummary: Record<string, number | string | boolean>;
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
  const probPercent = (prediction.probability * 100).toFixed(1);

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
      
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delay Probability</span>
          <span className={`text-xl font-black tabular-nums ${theme.text}`}>{probPercent}%</span>
        </div>
        <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-slate-200/60">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ 
              width: `${prediction.probability * 100}%`,
              backgroundColor: prediction.riskLabel === 'High' ? '#f43f5e' : prediction.riskLabel === 'Medium' ? '#f59e0b' : '#10b981'
            }}
          />
        </div>
      </div>
      
      <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-200/50">
        Predicted {new Date(prediction.predictedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
