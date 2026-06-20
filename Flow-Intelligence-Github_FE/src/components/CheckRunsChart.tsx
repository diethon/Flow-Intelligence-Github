import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CheckBreakdown } from "../types/metrics.js";

interface CheckRunsChartProps {
  data: CheckBreakdown[];
  totalRuns: number;
  failedRuns: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium text-xs">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function CheckRunsChart({ data, totalRuns, failedRuns }: CheckRunsChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No check run data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name,
    Success: d.total - d.failed,
    Failed: d.failed,
    "Fail Rate": d.failRate,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Check Runs by Suite</h3>
        <div className="flex gap-3 text-xs">
          <span className="text-slate-400 font-medium">{totalRuns} total</span>
          <span className="text-rose-500 font-semibold">{failedRuns} failed</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 8 }}
          />
          <Bar dataKey="Success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Fail rate table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs min-w-[360px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-medium">Check Suite</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-right px-3 py-2 font-medium">Failed</th>
              <th className="text-right px-3 py-2 font-medium">Fail Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((d, i) => (
              <tr
                key={d.name}
                className={`hover:bg-slate-50/50 transition-colors ${i % 2 === 0 ? "bg-slate-50/20" : "bg-white"}`}
              >
                <td className="px-3 py-2 text-slate-700 font-medium">{d.name}</td>
                <td className="px-3 py-2 text-right text-slate-500">{d.total}</td>
                <td className="px-3 py-2 text-right text-rose-500 font-medium">{d.failed}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`font-semibold ${
                      d.failRate > 40
                        ? "text-rose-600"
                        : d.failRate > 20
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {d.failRate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
