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

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

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
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-slate-800">{d.login}</p>
      <p className="text-slate-500">{d.count} reviews</p>
      <p className="text-indigo-600 font-bold">{d.pct}% of total</p>
    </div>
  );
}

export function ReviewLoadChart({ data, totalReviews }: ReviewLoadChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No review data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Review Load by Reviewer</h3>
        <span className="text-xs text-slate-400 font-medium">{totalReviews} total reviews</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="login"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Reviews",
              angle: -90,
              position: "insideLeft",
              fill: "#94a3b8",
              fontSize: 10,
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
        {data.map((d, i) => (
          <div key={d.reviewerId} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-slate-600 font-medium">{d.login}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-slate-400">{d.count} reviews</span>
              <span className="font-semibold" style={{ color: COLORS[i % COLORS.length] }}>
                {d.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
