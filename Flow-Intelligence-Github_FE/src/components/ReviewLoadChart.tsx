import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ReviewerBreakdown } from "../types/metrics.js";

interface ReviewLoadChartProps {
  data: ReviewerBreakdown[];
  totalReviews: number;
}

const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#a78bfa", "#f472b6", "#34d399"];

interface TooltipPayload {
  value: number;
  payload: ReviewerBreakdown;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-white">{d.login}</p>
      <p className="text-slate-300">{d.count} reviews</p>
      <p className="text-amber-400">{d.pct}% of total</p>
    </div>
  );
}

export function ReviewLoadChart({ data, totalReviews }: ReviewLoadChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No review data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Review Load by Reviewer</h3>
        <span className="text-xs text-slate-400">{totalReviews} total reviews</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="login"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Reviews",
              angle: -90,
              position: "insideLeft",
              fill: "#64748b",
              fontSize: 11,
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 space-y-1">
        {data.map((d, i) => (
          <div key={d.reviewerId} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-slate-300">{d.login}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-400">{d.count} reviews</span>
              <span className="font-medium" style={{ color: COLORS[i % COLORS.length] }}>
                {d.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
