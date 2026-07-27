import { useEffect, useState } from "react";
import { fetchDashboardRepositories } from "../api/dashboardApi";
import { useAuth } from "./useAuth";
import type { Repository } from "../types/dashboard";
import { canManagePrivacySettings } from "../utils/modulePermissions";

export function useSelectedRepositoryPermissions() {
  const { user } = useAuth();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(user?.role !== "admin");

  useEffect(() => {
    if (user?.role === "admin") {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const repositories = await fetchDashboardRepositories();
        const selectedId = localStorage.getItem("selectedRepositoryId");
        const selected =
          repositories.find((item) => item._id === selectedId) ??
          repositories[0] ??
          null;
        if (active) setRepository(selected);
      } catch {
        if (active) setRepository(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const handleEvent = () => { void load(); };
    window.addEventListener("repoChanged", handleEvent);
    window.addEventListener("selectedRepoChanged", handleEvent);
    window.addEventListener("selectedRepositoryChanged", handleEvent);
    window.addEventListener("storage", handleEvent);
    return () => {
      active = false;
      window.removeEventListener("repoChanged", handleEvent);
      window.removeEventListener("selectedRepoChanged", handleEvent);
      window.removeEventListener("selectedRepositoryChanged", handleEvent);
      window.removeEventListener("storage", handleEvent);
    };
  }, [user?.role]);

  return {
    loading,
    repository,
    canManagePrivacy: canManagePrivacySettings({
      globalRole: user?.role,
      repositoryRole: repository?.role,
    }),
  };
}
