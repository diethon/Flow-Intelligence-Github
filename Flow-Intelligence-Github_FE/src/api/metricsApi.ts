import apiClient from "../services/axiosClient.js";
import type {
  Repository,
  UC10MetricsResult,
  ComparisonResult,
} from "../types/metrics.js";

// ─── Repository API ───────────────────────────────────────────────────────────

export async function fetchRepositories(): Promise<Repository[]> {
  const res = await apiClient.get<{ repositories: Repository[] }>("/metrics/repositories");
  return res.data.repositories;
}

// ─── UC-10 Metrics API ────────────────────────────────────────────────────────

export async function fetchReviewCIMetrics(
  repoId: string,
  windowDays: number = 7,
  startDate?: string,
  endDate?: string
): Promise<UC10MetricsResult> {
  const res = await apiClient.get<{ success: boolean; data: UC10MetricsResult }>(
    `/metrics/repositories/${repoId}/review-ci`,
    { params: { windowDays, startDate, endDate } }
  );
  return res.data.data;
}

export async function calculateAndPersistMetrics(
  repoId: string,
  windowDays: number = 7,
  startDate?: string,
  endDate?: string
): Promise<UC10MetricsResult> {
  const res = await apiClient.post<{ success: boolean; data: UC10MetricsResult }>(
    `/metrics/repositories/${repoId}/review-ci/calculate`,
    { windowDays, startDate, endDate }
  );
  return res.data.data;
}

export async function fetchMetricsComparison(
  repoId: string,
  windowDays: number = 7,
  startDate?: string,
  endDate?: string
): Promise<ComparisonResult> {
  const res = await apiClient.get<{ success: boolean; data: ComparisonResult }>(
    `/metrics/repositories/${repoId}/review-ci/comparison`,
    { params: { windowDays, startDate, endDate } }
  );
  return res.data.data;
}



