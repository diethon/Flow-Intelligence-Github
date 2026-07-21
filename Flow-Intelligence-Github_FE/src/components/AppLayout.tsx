import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "../services/axiosClient";
import { ChatWidget } from "./ChatWidget.js";

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
      { to: "/risk",          label: "Risk",            icon: "◆", done: true  },
      { to: "/evidence",      label: "Evidence",        icon: "◈", done: true  },
      { to: "/workload-risk", label: "Workload Risk",   icon: "🌙", done: true  },
      { to: "/brief",         label: "AI Weekly Brief", icon: "◇", done: true },
    ],
  },
  {
    group: "Settings",
    items: [
      { to: "/repositories/connect", label: "Connected Repos", icon: "🔌", done: true  },
      { to: "/privacy", label: "Privacy Settings", icon: "◌", done: true },
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
            {group.group}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              // Global nav targets (e.g. /risk, /evidence) also match their
              // repo-scoped routes (/repositories/:id/risk, .../evidence/:cardId).
              const active =
                pathname.startsWith(item.to) ||
                pathname.endsWith(item.to) ||
                pathname.includes(`${item.to}/`);
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
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm"
                      : item.done
                      ? "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      : "text-slate-300 cursor-default"
                    }`}
                >
                  <span className={`text-base leading-none flex-shrink-0 ${active ? "text-indigo-600" : item.done ? "text-slate-400" : "text-slate-300"}`}>
                    {item.icon}
                  </span>
                  <span className="flex-1 font-medium truncate">{item.label}</span>
                  {!item.done && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
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
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-indigo-600/20 flex-shrink-0">
        FI
      </div>
      <div>
        <div className="text-base font-bold text-slate-900 leading-none">Flow Intelligence</div>
        <div className="text-xs text-slate-400 mt-1">GitHub Analytics</div>
      </div>
    </div>
  );
}

// ─── Shared nav links ─────────────────────────────────────────────────────────

function LogoutButton() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      navigate('/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-all"
    >
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Log out
    </button>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

export function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white border-r border-slate-200 fixed left-0 top-0 bottom-0 z-30">
      <div className="px-5 pt-6 pb-5 border-b border-slate-100">
        <Logo />
      </div>
      <NavLinks />
      <div className="px-4 py-4 border-t border-slate-100">
        <LogoutButton />
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="3" y1="6"  x2="17" y2="6"  />
            <line x1="3" y1="12" x2="17" y2="12" />
            <line x1="3" y1="18" x2="17" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            FI
          </div>
          <span className="text-sm font-bold text-slate-900">Flow Intelligence</span>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white border-r border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 pt-6 pb-5 border-b border-slate-100 flex items-center justify-between">
          <Logo />
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors ml-2"
          >
            ✕
          </button>
        </div>
        <NavLinks onItemClick={() => setOpen(false)} />
        <div className="px-4 py-4 border-t border-slate-100">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DesktopSidebar />
      <MobileNav />
      <div className="lg:pl-60 pt-14 lg:pt-0">
        {children}
      </div>
      <ChatWidget />
    </div>
  );
}
