import type { PerPRPickup } from "../types/metrics.js";

interface PRPickupTableProps {
  data: PerPRPickup[];
}

function pickupBadge(hours: number | null) {
  if (hours === null) return { label: "No review", className: "bg-slate-100 text-slate-600 border border-slate-200" };
  if (hours <= 4) return { label: "Fast", className: "bg-emerald-50 text-emerald-700 border border-emerald-100" };
  if (hours <= 12) return { label: "Moderate", className: "bg-amber-50 text-amber-700 border border-amber-100" };
  return { label: "Slow", className: "bg-rose-50 text-rose-700 border border-rose-100" };
}

export function PRPickupTable({ data }: PRPickupTableProps) {
  if (!data.length) {
    return <p className="text-sm text-slate-500 italic">No PR data available in this window.</p>;
  }

  const sorted = [...data].sort((a, b) => {
    if (a.pickupHours === null && b.pickupHours === null) return 0;
    if (a.pickupHours === null) return 1;
    if (b.pickupHours === null) return -1;
    return b.pickupHours - a.pickupHours;
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs min-w-[480px]">
        <thead>
          <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-semibold">PR</th>
            <th className="text-left px-4 py-3 font-semibold">Title</th>
            <th className="text-right px-4 py-3 font-semibold">Pickup Time</th>
            <th className="text-right px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((pr, i) => {
            const badge = pickupBadge(pr.pickupHours);
            return (
              <tr
                key={pr.prNumber}
                className={`hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? "bg-slate-50/30" : "bg-white"}`}
              >
                <td className="px-4 py-3 text-slate-500 font-mono">#{pr.prNumber}</td>
                <td className="px-4 py-3 text-slate-700 font-medium max-w-[200px] truncate" title={pr.title}>
                  {pr.title}
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-semibold">
                  {pr.pickupHours !== null
                    ? pr.pickupHours >= 24
                      ? `${(pr.pickupHours / 24).toFixed(1)}d`
                      : `${pr.pickupHours.toFixed(1)}h`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
