import axios from "axios";
import type { DashboardSummary, RulebookEntry, Repository } from "../types/dashboard.js";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });

export async function fetchDashboardRepositories(): Promise<Repository[]> {
  const res = await api.get<{ success: boolean; data: Repository[] }>("/dashboard/repositories");
  return res.data.data;
}

export async function fetchDashboard(repoId: string, windowDays = 7): Promise<DashboardSummary> {
  const res = await api.get<{ success: boolean; data: DashboardSummary }>(
    `/dashboard/repositories/${repoId}`,
    { params: { windowDays } }
  );
  return res.data.data;
}

export async function fetchRulebook(): Promise<RulebookEntry[]> {
  const res = await api.get<{ success: boolean; data: RulebookEntry[] }>("/dashboard/rulebook");
  return res.data.data;
}

export async function seedAndFetchRepo(): Promise<string> {
  const seed = await api.post<{ success: boolean; repositoryId: string }>("/seed");
  return seed.data.repositoryId;
}
