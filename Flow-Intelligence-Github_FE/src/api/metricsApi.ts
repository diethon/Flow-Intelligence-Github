import axios from "axios";
import type {
  Repository,
  UC10MetricsResult,
  ComparisonResult,
} from "../types/metrics.js";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ─── Repository API ───────────────────────────────────────────────────────────

export async function fetchRepositories(): Promise<Repository[]> {
  const res = await api.get<{ repositories: Repository[] }>("/metrics/repositories");
  return res.data.repositories;
}

// ─── UC-10 Metrics API ────────────────────────────────────────────────────────

export async function fetchReviewCIMetrics(
  repoId: string,
  windowDays: number = 7
): Promise<UC10MetricsResult> {
  const res = await api.get<{ success: boolean; data: UC10MetricsResult }>(
    `/metrics/repositories/${repoId}/review-ci`,
    { params: { windowDays } }
  );
  return res.data.data;
}

export async function calculateAndPersistMetrics(
  repoId: string,
  windowDays: number = 7
): Promise<UC10MetricsResult> {
  const res = await api.post<{ success: boolean; data: UC10MetricsResult }>(
    `/metrics/repositories/${repoId}/review-ci/calculate`,
    { windowDays }
  );
  return res.data.data;
}

export async function fetchMetricsComparison(
  repoId: string,
  windowDays: number = 7
): Promise<ComparisonResult> {
  const res = await api.get<{ success: boolean; data: ComparisonResult }>(
    `/metrics/repositories/${repoId}/review-ci/comparison`,
    { params: { windowDays } }
  );
  return res.data.data;
}

// ─── Seed API ─────────────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<{ repositoryId: string; message: string }> {
  const res = await api.post<{ success: boolean; repositoryId: string; message: string }>("/seed");
  return { repositoryId: res.data.repositoryId, message: res.data.message };
}
