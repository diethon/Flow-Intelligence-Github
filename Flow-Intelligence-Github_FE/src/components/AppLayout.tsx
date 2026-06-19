import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const NAV = [
  {
    group: "Analytics",
    items: [
      { to: "/dashboard", label: "Team Dashboard",      icon: "▣", done: true  },
      { to: "/review-ci", label: "Review & CI Metrics", icon: "◈", done: true  },
      { to: "/rulebook",  label: "Flow Risk Rulebook",  icon: "◉", done: true  },
    ],
  },
  {
    group: "Insights",
    items: [
      { to: "/risk",  label: "Risk & Evidence", icon: "◆", done: true  },
      { to: "/brief", label: "AI Weekly Brief", icon: "◇", done: false },
    ],
  },
  {
    group: "Settings",
    items: [
      { to: "/privacy", label: "Privacy Settings", icon: "◌", done: false },
    ],
  },
];

// ─── Shared nav links ─────────────────────────────────────────────────────────

function NavLinks({ onItemClick }: { onItemClick?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">
            {group.group}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={(e) => {
                    if (!item.done) { e.preventDefault(); return; }
                    onItemClick?.();
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all
                    ${active
                      ? "bg-indigo-600/20 text-white border border-indigo-500/30 shadow-sm"
                      : item.done
                      ? "text-slate-400 hover:text-white hover:bg-slate-800"
                      : "text-slate-700 cursor-default"
                    }`}
                >
                  <span className={`text-base leading-none flex-shrink-0 ${active ? "text-indigo-400" : item.done ? "text-slate-500" : "text-slate-700"}`}>
                    {item.icon}
                  </span>
                  <span className="flex-1 font-medium truncate">{item.label}</span>
                  {!item.done && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0" />
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-violet-900/50 flex-shrink-0">
        FI
      </div>
      <div>
        <div className="text-base font-bold text-white leading-none">Flow Intelligence</div>
        <div className="text-xs text-slate-500 mt-1">GitHub Analytics</div>
      </div>
    </div>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

export function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-slate-900 border-r border-slate-800/80 fixed left-0 top-0 bottom-0 z-30">
      <div className="px-5 pt-6 pb-5 border-b border-slate-800/80">
        <Logo />
      </div>
      <NavLinks />
      <div className="px-4 py-4 border-t border-slate-800/80">
        <p className="text-xs text-slate-600">Điểm Vi · Flow Intelligence MVP</p>
      </div>
    </aside>
  );
}

// ─── Mobile Nav (top bar + drawer) ───────────────────────────────────────────

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="3" y1="6"  x2="17" y2="6"  />
            <line x1="3" y1="12" x2="17" y2="12" />
            <line x1="3" y1="18" x2="17" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            FI
          </div>
          <span className="text-sm font-bold text-white">Flow Intelligence</span>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-slate-900 border-r border-slate-800/80 shadow-2xl shadow-black/60 transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 pt-6 pb-5 border-b border-slate-800/80 flex items-center justify-between">
          <Logo />
          <button
            onClick={() => setOpen(false)}
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors ml-2"
          >
            ✕
          </button>
        </div>
        <NavLinks onItemClick={() => setOpen(false)} />
        <div className="px-4 py-4 border-t border-slate-800/80">
          <p className="text-xs text-slate-600">Điểm Vi · Flow Intelligence MVP</p>
        </div>
      </aside>
    </>
  );
}
