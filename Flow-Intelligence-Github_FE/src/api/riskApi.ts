import apiClient from "../services/axiosClient.js";
import type { RiskEvaluationResult } from "../types/risk.js";

/** POST — Run full R1–R5 evaluation, persist events, return result */
export async function evaluateRisk(
  repoId: string,
  windowDays: number,
  startDate?: string,
  endDate?: string
): Promise<RiskEvaluationResult> {
  const res = await apiClient.post<{ success: boolean; data: RiskEvaluationResult }>(
    `/risk/repositories/${repoId}/evaluate`,
    { windowDays, startDate, endDate }
  );
  return res.data.data;
}

/** GET — Return previously stored risk events (no recalculation) */
export async function fetchRiskEvents(
  repoId: string,
  windowDays: number,
  startDate?: string,
  endDate?: string
): Promise<RiskEvaluationResult | null> {
  const res = await apiClient.get<{ success: boolean; data: RiskEvaluationResult | null }>(
    `/risk/repositories/${repoId}/events`,
    { params: { windowDays, startDate, endDate } }
  );
  return res.data.data;
}

