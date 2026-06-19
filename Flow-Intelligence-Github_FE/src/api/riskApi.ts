import axios from "axios";
import type { RiskEvaluationResult } from "../types/risk.js";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

/** POST — Run full R1–R5 evaluation, persist events, return result */
export async function evaluateRisk(repoId: string, windowDays: number): Promise<RiskEvaluationResult> {
  const res = await api.post<{ success: boolean; data: RiskEvaluationResult }>(
    `/risk/repositories/${repoId}/evaluate`,
    { windowDays }
  );
  return res.data.data;
}

/** GET — Return previously stored risk events (no recalculation) */
export async function fetchRiskEvents(repoId: string, windowDays: number): Promise<RiskEvaluationResult | null> {
  const res = await api.get<{ success: boolean; data: RiskEvaluationResult | null }>(
    `/risk/repositories/${repoId}/events`,
    { params: { windowDays } }
  );
  return res.data.data;
}
