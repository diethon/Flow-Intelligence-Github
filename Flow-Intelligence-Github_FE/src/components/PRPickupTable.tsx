import type { PerPRPickup } from "../types/metrics.js";

interface PRPickupTableProps {
  data: PerPRPickup[];
}

function pickupBadge(hours: number | null) {
  if (hours === null) return { label: "No review", className: "bg-slate-700/60 text-slate-400" };
  if (hours <= 4) return { label: "Fast", className: "bg-emerald-500/20 text-emerald-400" };
  if (hours <= 12) return { label: "Moderate", className: "bg-amber-500/20 text-amber-400" };
  return { label: "Slow", className: "bg-red-500/20 text-red-400" };
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
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-xs min-w-[480px]">
        <thead>
          <tr className="bg-slate-800/60 text-slate-400">
            <th className="text-left px-3 py-2 font-medium">PR</th>
            <th className="text-left px-3 py-2 font-medium">Title</th>
            <th className="text-right px-3 py-2 font-medium">Pickup Time</th>
            <th className="text-right px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pr, i) => {
            const badge = pickupBadge(pr.pickupHours);
            return (
              <tr
                key={pr.prNumber}
                className={`border-t border-slate-700/60 ${i % 2 === 0 ? "bg-slate-800/20" : ""}`}
              >
                <td className="px-3 py-2 text-slate-400 font-mono">#{pr.prNumber}</td>
                <td className="px-3 py-2 text-slate-300 max-w-[200px] truncate" title={pr.title}>
                  {pr.title}
                </td>
                <td className="px-3 py-2 text-right text-slate-300">
                  {pr.pickupHours !== null
                    ? pr.pickupHours >= 24
                      ? `${(pr.pickupHours / 24).toFixed(1)}d`
                      : `${pr.pickupHours.toFixed(1)}h`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.className}`}>
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
