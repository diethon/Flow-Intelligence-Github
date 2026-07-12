import { useState, useEffect } from "react";
import { dataQualityApi, type DataQualityData } from "../api/dataQualityApi";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { PartialDataState } from "./PartialDataState";

export function DataQualityPanel({ repositoryId }: { repositoryId: string }) {
  const [data, setData] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repositoryId) return;
    setLoading(true);
    dataQualityApi.getQuality(repositoryId)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [repositoryId]);

  if (loading) return <LoadingState message="Checking Data Quality..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          🛡️ Data Quality Check
        </h3>
        <span
          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
            data.status === "GOOD"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : data.status === "PARTIAL"
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {data.status}
        </span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Score:</span>
          <span className="font-semibold text-slate-700">{data.score}/100</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Last Synced:</span>
          <span className="font-semibold text-slate-700">
            {data.lastSync ? new Date(data.lastSync).toLocaleString() : "Never"}
          </span>
        </div>
      </div>

      {data.status === "PARTIAL" && data.missingData.length > 0 && (
        <PartialDataState message="Data is incomplete" missingData={data.missingData} />
      )}
      
      {data.status === "POOR" && (
        <div className="bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-lg p-3 leading-relaxed mt-3">
          ⚠️ Data quality is poor. Analytics may be highly inaccurate.
        </div>
      )}

      {data.status === "GOOD" && (
        <div className="bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 rounded-lg p-3 flex items-start gap-2 mt-2 leading-relaxed">
          <span>✓</span> All repository integration pipelines are running clean without warning flags.
        </div>
      )}
    </div>
  );
}
