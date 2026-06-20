import { useState, useRef, useEffect, type ReactNode } from "react";

// ─── Page Shell ───────────────────────────────────────────────────────────────

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Sticky header — single row, title left / actions right */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center gap-4">
          {/* Title (shrinks if needed) */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>

          {/* Actions — scrollable horizontally, never wrap */}
          {actions && (
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 overflow-x-auto scrollbar-none max-w-[55%] sm:max-w-none">
              {actions}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {children}
      </main>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: string; badge?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 overflow-x-auto scrollbar-none">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
            active === t.id
              ? "bg-white text-indigo-600 border border-slate-200/60 shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
          }`}
        >
          {t.icon && <span>{t.icon}</span>}
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              active === t.id ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-rose-500/10 text-rose-600"
            }`}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

export function SectionHeading({ title, subtitle, right }: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-transparent animate-spin"
      style={{ width: size, height: size, borderTopColor: color, borderRightColor: color + "40" }}
    />
  );
}

// ─── Window selector (popup) ──────────────────────────────────────────────────

export interface WindowOption { days: number; label: string; sublabel?: string }

export const WINDOW_OPTIONS: WindowOption[] = [
  { days: 1,   label: "1 day",    sublabel: "Today"     },
  { days: 7,   label: "1 week",   sublabel: "7 days"    },
  { days: 30,  label: "1 month",  sublabel: "30 days"   },
  { days: 180, label: "6 months", sublabel: "180 days"  },
  { days: 365, label: "1 year",   sublabel: "365 days"  },
];

export function WindowSelector({
  value,
  onChange,
  startDate,
  endDate,
  onCustomRangeChange,
}: {
  value: number;
  onChange: (days: number) => void;
  startDate?: string;
  endDate?: string;
  onCustomRangeChange?: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localStart, setLocalStart] = useState(startDate || "");
  const [localEnd, setLocalEnd] = useState(endDate || "");
  
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startDate) setLocalStart(startDate);
  }, [startDate]);

  useEffect(() => {
    if (endDate) setLocalEnd(endDate);
  }, [endDate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!target || !target.isConnected) {
        return; // Clicked target was removed from DOM, ignore
      }
      if (ref.current && !ref.current.contains(target)) {
        // Check shadow DOM path
        const path = e.composedPath ? e.composedPath() : [];
        if (path.includes(ref.current)) {
          return;
        }
        // Check if focus is still inside the dropdown container (helps with browser calendar widget overlay)
        if (document.activeElement && ref.current.contains(document.activeElement)) {
          return;
        }
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (localStart && localEnd && onCustomRangeChange) {
      onCustomRangeChange(localStart, localEnd);
      onChange(0); // 0 indicates custom range is active
      setOpen(false);
    }
  };

  const handlePresetSelect = (opt: typeof WINDOW_OPTIONS[number]) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - opt.days);
    
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];
    
    setLocalStart(startStr);
    setLocalEnd(endStr);
    
    if (onCustomRangeChange) {
      onCustomRangeChange(startStr, endStr);
    }
    onChange(opt.days);
    setOpen(false);
  };

  const getButtonLabel = () => {
    if (startDate && endDate) {
      const formatDate = (dStr: string) => {
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? dStr : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      };
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    const selected = WINDOW_OPTIONS.find((o) => o.days === value);
    return selected ? selected.label : "Select Date Range";
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
          open
            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
            : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400"
        }`}
      >
        <span className="text-slate-400 text-base">📅</span>
        <span>{getButtonLabel()}</span>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Date Range</p>
          </div>
          
          <form onSubmit={handleApplyCustom} className="p-4 space-y-3">
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Start Date</label>
              <input
                type="date"
                required
                value={localStart}
                onChange={(e) => setLocalStart(e.target.value)}
                className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">End Date</label>
              <input
                type="date"
                required
                value={localEnd}
                onChange={(e) => setLocalEnd(e.target.value)}
                className="w-full text-xs border border-slate-250 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 bg-white text-slate-800"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition-all"
            >
              Apply Date Range
            </button>
          </form>

          <div className="border-t border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Quick Presets</p>
            <div className="grid grid-cols-2 gap-1.5">
              {WINDOW_OPTIONS.map((opt) => {
                const presetActive = opt.days === value;
                return (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => handlePresetSelect(opt)}
                    className={`px-2 py-1 text-left text-xs rounded transition-colors ${
                      presetActive
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Repo selector ────────────────────────────────────────────────────────────

export function RepoSelect({ repos, value, onChange }: {
  repos: { _id: string; fullName: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-400 transition-colors w-auto min-w-[180px] max-w-xs cursor-pointer"
    >
      {repos.length === 0 && <option value="">No repositories connected</option>}
      {repos.map((r) => <option key={r._id} value={r._id}>{r.fullName}</option>)}
    </select>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export function GhostBtn({ onClick, disabled, loading, children }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 disabled:opacity-40 transition-all shadow-sm"
    >
      {loading ? <Spinner size={14} color="#64748b" /> : null}
      {children}
    </button>
  );
}

export function PrimaryBtn({ onClick, disabled, loading, children }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-600/10"
    >
      {loading ? <Spinner size={14} color="white" /> : null}
      {children}
    </button>
  );
}

// ─── Error alert ──────────────────────────────────────────────────────────────

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4">
      <span className="text-rose-500 text-lg flex-shrink-0">⚠</span>
      <p className="text-sm text-rose-700 leading-relaxed">{message}</p>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon: string; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
      <span className="text-6xl">{icon}</span>
      <div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
