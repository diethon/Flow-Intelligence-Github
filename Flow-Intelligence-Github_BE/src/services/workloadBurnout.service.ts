import { GoogleGenAI } from "@google/genai";
import { calculateWorkloadRisk, pseudonymLabel, type WorkloadRiskResult } from "./metricsEngine.js";
import { evidenceCardService } from "./evidenceCard.service";

export interface WorkloadAiItem {
  type: "risk_summary" | "recommendation";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | "info";
}

export interface WorkloadAiAnalysis {
  summary: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
  items: WorkloadAiItem[];
  isFallback: boolean;
}

export interface WorkloadAnalyzeResult {
  severity: WorkloadRiskResult["severity"];
  aggregate: WorkloadRiskResult["aggregate"];
  breakdown: WorkloadRiskResult["breakdown"];
  card: unknown | null;
  aiAnalysis: WorkloadAiAnalysis | null;
}

const WORKLOAD_LIMITATION =
  "Only GitHub commit/review timestamps were analyzed. Off-hours are computed in UTC without timezone normalization.";

export class WorkloadBurnoutService {
  /**
   * Developer Burnout Predictor entrypoint: compute the off-hours workload
   * signal, turn it into an evidence-backed card, and run it through AI.
   *
   * Returns early (no card, no AI) when the signal is not actionable —
   * insufficient data / below the privacy group threshold, or below medium
   * severity — so we neither surface noise nor risk exposing individuals.
   */
  async analyze(
    repositoryId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<WorkloadAnalyzeResult> {
    const risk = await calculateWorkloadRisk(repositoryId, windowStart, windowEnd);

    if (
      risk.aggregate.dataStatus === "insufficient_data" ||
      risk.severity === "low" ||
      risk.evidenceRefs.length === 0
    ) {
      return {
        severity: risk.severity,
        aggregate: risk.aggregate,
        breakdown: risk.breakdown,
        card: null,
        aiAnalysis: null,
      };
    }

    const summary = this.buildSummary(risk);

    // Build the Evidence Card in-memory only — do NOT persist. Workload Risk is a
    // page-local signal; persisting would flood the shared Evidence list with a
    // new card on every analyze() run (see evidenceCard.service.buildRiskEventCard).
    const card = await evidenceCardService.buildRiskEventCard(repositoryId, {
      ruleCode: "W1",
      severity: risk.severity,
      title: "Workload Risk: off-hours activity elevated",
      summary,
      confidence: "medium",
      limitation: WORKLOAD_LIMITATION,
      affectedEntityRefs: risk.evidenceRefs,
    });

    const aiAnalysis = await this.runAi(risk, summary);

    return { severity: risk.severity, aggregate: risk.aggregate, breakdown: risk.breakdown, card, aiAnalysis };
  }

  private buildSummary(risk: WorkloadRiskResult): string {
    const a = risk.aggregate;
    return (
      `${a.offHoursPct ?? 0}% of ${a.totalEvents} commit/review events occurred off-hours ` +
      `(${a.weekendCount} on weekends, ${a.nightCount} at night, UTC) across ` +
      `${a.distinctContributorsOffHours} contributors.`
    );
  }

  /** Structured, redacted payload — counts and masked labels only, no raw text. */
  private buildAiPayload(risk: WorkloadRiskResult, summary: string) {
    return {
      signal: "workload_risk",
      severity: risk.severity,
      summary,
      aggregate: {
        totalEvents: risk.aggregate.totalEvents,
        offHoursEvents: risk.aggregate.offHoursEvents,
        offHoursPct: risk.aggregate.offHoursPct,
        weekendCount: risk.aggregate.weekendCount,
        nightCount: risk.aggregate.nightCount,
        distinctContributorsOffHours: risk.aggregate.distinctContributorsOffHours,
      },
      // The UI shows real identities, but we never send names to the AI provider:
      // relabel the breakdown to "Contributor A/B…" before it leaves our server.
      breakdown: risk.breakdown.map((b, idx) => ({
        label: pseudonymLabel(idx),
        totalCommits: b.totalCommits,
        offHoursEvents: b.offHoursEvents,
        weekend: b.weekend,
        night: b.night,
      })),
      limitations: [WORKLOAD_LIMITATION],
    };
  }

  private async runAi(risk: WorkloadRiskResult, summary: string): Promise<WorkloadAiAnalysis> {
    const payload = this.buildAiPayload(risk, summary);

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing. Falling back to deterministic analysis.");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are analyzing a team-level "Workload Risk" (developer burnout) signal derived from off-hours GitHub activity. Do NOT judge individuals or produce productivity rankings; use workflow-oriented, supportive language. Provide an executive summary, a list of limitations, and an array of items (each item having type 'risk_summary' or 'recommendation', title, detail, severity 'high'|'medium'|'low'|'info'). Output strictly in valid JSON matching this schema: { "summary": "string", "confidence": "high"|"medium"|"low", "limitations": ["string"], "items": [{ "type": "risk_summary"|"recommendation", "title": "string", "detail": "string", "severity": "high"|"medium"|"low"|"info" }] }

Payload data: ${JSON.stringify(payload)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const parsed = JSON.parse(response.text || "{}");
      return {
        summary: parsed.summary || summary,
        confidence: parsed.confidence || "medium",
        limitations: parsed.limitations || payload.limitations,
        items: parsed.items || [],
        isFallback: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Workload AI generation failed, using deterministic fallback:", message);
      return this.deterministicFallback(risk, summary);
    }
  }

  private deterministicFallback(risk: WorkloadRiskResult, summary: string): WorkloadAiAnalysis {
    return {
      summary,
      confidence: "low",
      limitations: ["AI service unavailable, using deterministic rules.", WORKLOAD_LIMITATION],
      items: [
        {
          type: "risk_summary",
          title: "Elevated off-hours activity",
          detail: `${risk.aggregate.offHoursPct ?? 0}% of activity happened outside business hours (UTC).`,
          severity: risk.severity,
        },
        {
          type: "recommendation",
          title: "Review workload distribution",
          detail:
            "Check whether deadlines or review load are pushing work into evenings and weekends, and rebalance where possible.",
          severity: "info",
        },
      ],
      isFallback: true,
    };
  }
}

export const workloadBurnoutService = new WorkloadBurnoutService();
