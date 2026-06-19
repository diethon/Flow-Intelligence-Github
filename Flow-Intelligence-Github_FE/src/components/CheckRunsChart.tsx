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
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function CheckRunsChart({ data, totalRuns, failedRuns }: CheckRunsChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
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
        <h3 className="text-sm font-semibold text-slate-200">Check Runs by Suite</h3>
        <div className="flex gap-3 text-xs">
          <span className="text-slate-400">{totalRuns} total</span>
          <span className="text-red-400">{failedRuns} failed</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }}
          />
          <Bar dataKey="Success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Fail rate table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs min-w-[360px]">
          <thead>
            <tr className="bg-slate-800/60 text-slate-400">
              <th className="text-left px-3 py-2 font-medium">Check Suite</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-right px-3 py-2 font-medium">Failed</th>
              <th className="text-right px-3 py-2 font-medium">Fail Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr
                key={d.name}
                className={`border-t border-slate-700/60 ${i % 2 === 0 ? "bg-slate-800/20" : ""}`}
              >
                <td className="px-3 py-2 text-slate-300 font-medium">{d.name}</td>
                <td className="px-3 py-2 text-right text-slate-400">{d.total}</td>
                <td className="px-3 py-2 text-right text-red-400">{d.failed}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`font-semibold ${
                      d.failRate > 40
                        ? "text-red-400"
                        : d.failRate > 20
                        ? "text-amber-400"
                        : "text-emerald-400"
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
