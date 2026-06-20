import apiClient from "../services/axiosClient.js";
import type { DashboardSummary, RulebookEntry, Repository } from "../types/dashboard.js";

export async function fetchDashboardRepositories(): Promise<Repository[]> {
  const res = await apiClient.get<{ success: boolean; data: Repository[] }>("/dashboard/repositories");
  return res.data.data;
}

export async function fetchDashboard(
  repoId: string,
  windowDays = 7,
  startDate?: string,
  endDate?: string
): Promise<DashboardSummary> {
  const res = await apiClient.get<{ success: boolean; data: DashboardSummary }>(
    `/dashboard/repositories/${repoId}`,
    { params: { windowDays, startDate, endDate } }
  );
  return res.data.data;
}

export async function fetchRulebook(): Promise<RulebookEntry[]> {
  const res = await apiClient.get<{ success: boolean; data: RulebookEntry[] }>("/dashboard/rulebook");
  return res.data.data;
}


