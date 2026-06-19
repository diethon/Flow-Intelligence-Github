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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Sticky header — single row, title left / actions right */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg shadow-black/20">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center gap-4">
          {/* Title (shrinks if needed) */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-white leading-tight truncate">{title}</h1>
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
    <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto scrollbar-none">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
            active === t.id
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          {t.icon && <span>{t.icon}</span>}
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              active === t.id ? "bg-white/20 text-white" : "bg-rose-500/30 text-rose-300"
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
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 14, color = "white" }: { size?: number; color?: string }) {
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
  { days: 14,  label: "2 weeks",  sublabel: "14 days"   },
  { days: 30,  label: "1 month",  sublabel: "30 days"   },
  { days: 90,  label: "1 quarter",sublabel: "90 days"   },
  { days: 180, label: "6 months", sublabel: "180 days"  },
  { days: 365, label: "1 year",   sublabel: "365 days"  },
];

export function WindowSelector({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = WINDOW_OPTIONS.find((o) => o.days === value) ?? WINDOW_OPTIONS[1];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
          open
            ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600"
        }`}
      >
        <span className="text-slate-400 text-base">📅</span>
        <span>{selected.label}</span>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 z-50 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Time Window</p>
          </div>
          <div className="py-1.5">
            {WINDOW_OPTIONS.map((opt) => {
              const active = opt.days === value;
              return (
                <button
                  key={opt.days}
                  onClick={() => { onChange(opt.days); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    active ? "bg-indigo-600/20 text-indigo-300" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{opt.sublabel}</span>
                    {active && <span className="text-indigo-400 font-bold">✓</span>}
                  </div>
                </button>
              );
            })}
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
      className="bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-600 transition-colors w-auto min-w-[180px] max-w-xs"
    >
      {repos.length === 0 && <option value="">No repos — seed first</option>}
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
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white disabled:opacity-40 transition-all"
    >
      {loading ? <Spinner size={14} color="#94a3b8" /> : null}
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
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-900/40"
    >
      {loading ? <Spinner size={14} color="white" /> : null}
      {children}
    </button>
  );
}

// ─── Error alert ──────────────────────────────────────────────────────────────

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-5 py-4">
      <span className="text-rose-400 text-lg flex-shrink-0">⚠</span>
      <p className="text-sm text-rose-200 leading-relaxed">{message}</p>
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
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
