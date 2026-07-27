import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../services/axiosClient";
import { useAuth } from "../hooks/useAuth";
import { fetchDashboardRepositories } from "../api/dashboardApi.js";
import { ChatWidget } from "./ChatWidget.js";

import { useSelectedRepositoryPermissions } from "../hooks/useSelectedRepositoryPermissions";


function NavLinks({ onItemClick }: { onItemClick?: () => void }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { canManagePrivacy } = useSelectedRepositoryPermissions();
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(() =>
    localStorage.getItem("selectedRepositoryId")
  );

  useEffect(() => {
    const handleRepoChange = () => {
      setSelectedRepoId(localStorage.getItem("selectedRepositoryId"));
    };
    window.addEventListener("selectedRepoChanged", handleRepoChange);
    window.addEventListener("storage", handleRepoChange);
    return () => {
      window.removeEventListener("selectedRepoChanged", handleRepoChange);
      window.removeEventListener("storage", handleRepoChange);
    };
  }, []);

  const reposQuery = useQuery({
    queryKey: ["dashboard", "repositories"],
    queryFn: fetchDashboardRepositories,
    enabled: !!user,
  });
  const repos = reposQuery.data ?? [];

  // Determine active repository context from URL or state
  const match = pathname.match(/\/repositories\/([^\/]+)/);
  const activeRepoId = match ? match[1] : (selectedRepoId || localStorage.getItem("selectedRepositoryId"));
  const activeRepo = repos.find((r) => r._id === activeRepoId) || repos[0];

  // Only render Workload Risk if global System Admin or Leader of the active repository
  const isLeaderOrAdmin =
    user?.role === "admin" || (activeRepo && activeRepo.role === "leader");

  const navItems = [
    {
      group: "Analytics",
      items: [
        { to: "/dashboard", label: "Team Dashboard", icon: "▣", done: true },
        { to: "/review-ci", label: "Review & CI Metrics", icon: "◈", done: true },
        { to: "/rulebook", label: "Flow Risk Rulebook", icon: "◉", done: true },
      ],
    },
    {
      group: "Insights",
      items: [
        { to: "/predictions", label: "PR Predictions", icon: "P", done: true },
        { to: "/risk", label: "Risk", icon: "◆", done: true },
        { to: "/evidence", label: "Evidence", icon: "◈", done: true },
        ...(isLeaderOrAdmin ? [{ to: "/workload-risk", label: "Workload Risk", icon: "▲", done: true }] : []),
        { to: "/brief", label: "AI Weekly Brief", icon: "◇", done: true },
      ],
    },
    {
      group: "Settings",
      items: [
        { to: "/repositories/connect", label: "Connected Repos", icon: "🔌", done: true },
        { to: "/privacy", label: "Privacy Settings", icon: "◌", done: true },
      ],
    },
  ];

  if (user && user.role === 'admin') {
    navItems.unshift({
      group: "Administration",
      items: [
        { to: "/admin/dashboard", label: "System Overview", icon: "📊", done: true },
        { to: "/users", label: "Users Management", icon: "👥", done: true }
      ]
    });
  }

  for (const group of navItems) {
    if (group.group === "Settings" && !canManagePrivacy) {
      group.items = group.items.filter((item) => item.to !== "/privacy");
    }
  }

  return (
    <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
      {navItems.map((group) => (
        <div key={group.group}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
            {group.group}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const compactLabel = item.to === "/workload-risk" || item.to === "/brief";
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
                  <span
                    className={`flex-1 min-w-0 font-medium ${compactLabel
                      ? "text-[12px] sm:text-[13px] leading-5 whitespace-nowrap"
                      : "truncate"
                      }`}
                  >
                    {item.label}
                  </span>
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
function useSelectedRepoRole() {
  const [repoId, setRepoId] = useState(() => localStorage.getItem("selectedRepositoryId"));
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const handleStorageChange = () => {
      setRepoId(localStorage.getItem("selectedRepositoryId"));
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("repoChanged", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("repoChanged", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    // Fetch the role for this repo silently
    apiClient.get(`/dashboard/repositories`).then(res => {
      const repos = res.data.data;
      const effectiveRepoId = repoId || (repos.length > 0 ? repos[0]._id : null);
      if (!effectiveRepoId) {
        setRole(null);
        return;
      }
      const repo = repos.find((r: any) => r._id === effectiveRepoId);
      if (repo && repo.role) {
        setRole(repo.role);
      } else {
        setRole('viewer');
      }
    }).catch(() => setRole(null));
  }, [repoId]);

  return role;
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

export function DesktopSidebar() {
  const { user } = useAuth();

  const repoRole = useSelectedRepoRole();
  const displayRole = user?.role === 'admin' ? 'admin' : (repoRole || '');

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-white border-r border-slate-200 fixed left-0 top-0 bottom-0 z-30">
      <div className="px-5 pt-6 pb-5 border-b border-slate-100">
        <Logo />
      </div>
      <NavLinks />
      {user && (
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full border border-slate-200 flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate">{user.username}</p>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">{displayRole}</p>
          </div>
        </div>
      )}
      <div className="px-4 py-4 border-t border-slate-100">
        <LogoutButton />
      </div>
    </aside>
  );
}

// ─── Mobile Nav (top bar + drawer) ───────────────────────────────────────────

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const repoRole = useSelectedRepoRole();
  const displayRole = user?.role === 'admin' ? 'admin' : (repoRole || '');

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
            <line x1="3" y1="6" x2="17" y2="6" />
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
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white border-r border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"
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
        {user && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full border border-slate-200 flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{user.username}</p>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">{displayRole}</p>
            </div>
          </div>
        )}
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
