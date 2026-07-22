import { GoogleGenAI } from "@google/genai";
import { calculateWorkloadRisk, pseudonymLabel, type WorkloadRiskResult } from "./metricsEngine.js";
import { evidenceCardService } from "./evidenceCard.service";

export interface WorkloadAiItem {
  type: "risk_summary" | "recommendation";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | "info";
}

/**
 * Per-member commentary. `contributor` carries the REAL GitHub login (the
 * Workload Risk page is allowed to show identities); the AI never sees it —
 * the note is generated against a pseudonym and re-labelled on our server.
 */
export interface WorkloadContributorInsight {
  contributor: string;
  note: string;
  suggestion?: string;
  totalEvents: number;
  offHoursEvents: number;
  commits: number;
  reviews: number;
  night: number;
  weekend: number;
}

export interface WorkloadAiAnalysis {
  summary: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
  items: WorkloadAiItem[];
  contributorInsights: WorkloadContributorInsight[];
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
  "Only GitHub commit/review timestamps were analyzed. Off-hours are computed in UTC without timezone normalization. Bot commits are credited to their Co-authored-by human when present, otherwise excluded.";

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
        commitCount: risk.aggregate.commitCount,
        reviewCount: risk.aggregate.reviewCount,
        offHoursCommitCount: risk.aggregate.offHoursCommitCount,
        offHoursReviewCount: risk.aggregate.offHoursReviewCount,
        distinctContributorsOffHours: risk.aggregate.distinctContributorsOffHours,
      },
      // The UI shows real identities, but we never send names to the AI provider:
      // relabel the breakdown to "Contributor A/B…" before it leaves our server.
      breakdown: risk.breakdown.map((b, idx) => ({
        id: idx,
        label: pseudonymLabel(idx),
        totalEvents: b.totalEvents,
        commits: b.commits,
        reviews: b.reviews,
        offHoursEvents: b.offHoursEvents,
        offHoursCommits: b.offHoursCommits,
        offHoursReviews: b.offHoursReviews,
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
      const prompt = `You are analyzing a team-level "Workload Risk" (developer burnout) signal derived from off-hours GitHub activity — commits and reviews that landed at night or on weekends (UTC).

Your job:
1. Read the report of overtime (night) and weekend activity in the payload.
2. In the executive summary and the 'risk_summary' items, explain WHY sustaining this pattern of overtime and weekend work is harmful — cover concrete consequences such as burnout and exhaustion, declining code quality and more bugs/rework, slower long-term delivery, erosion of work-life balance, and rising turnover risk. Ground the reasoning in the actual numbers (off-hours %, night vs weekend counts, how many contributors are affected).
3. In the 'recommendation' items, give practical, actionable remediation the team can adopt — e.g. rebalancing workload and review load, adjusting deadlines/scope, setting healthy off-hours norms, adding backup reviewers, protecting weekends, and monitoring the trend.
4. Include AT LEAST one recommendation on how to protect delivery timelines WHEN THE PROJECT IS GENUINELY URGENT, without relying on sustained overtime — e.g. ruthless prioritization / cutting or deferring non-critical scope (MoSCoW), parallelizing work and adding temporary help, timeboxing any crunch to a short, explicit, agreed period followed by recovery time, rotating who takes on-call/late work so no one carries it alone, and unblocking the critical path (fast reviews, removing dependencies) rather than adding hours. Make clear that occasional short bursts can be acceptable but a permanent crunch is not.

5. For EACH contributor in the payload 'breakdown', produce a 'perContributor' entry giving a detailed, supportive note about that person's activity pattern and their contribution. Base it strictly on their numbers: how much they contributed (commits and reviews), how much of it landed off-hours, and the night vs weekend split. Point out if someone is carrying a lot of off-hours load or is the main reviewer, and add a short workflow-oriented suggestion for them (e.g. share review load, protect their evenings). You MAY comment on each contributor individually here.

Rules: Refer to each contributor ONLY by the given pseudonym label and 'id' (e.g. "Contributor A") — never invent or guess real names. Keep it supportive and workflow-oriented: do NOT rank contributors against each other, do NOT score productivity, and do NOT frame anything as HR/performance evaluation. Be specific and reference the numbers where relevant. Do NOT produce any item about timezones, timezone normalization/distribution, mapping contributor locations, verifying where people work, or adjusting a UTC baseline — treat the off-hours numbers as given and focus only on workload, scope, review flow, and delivery.

Provide an executive summary, a list of limitations, an array of items, and a 'perContributor' array with one entry per contributor. Output strictly in valid JSON matching this schema: { "summary": "string", "confidence": "high"|"medium"|"low", "limitations": ["string"], "items": [{ "type": "risk_summary"|"recommendation", "title": "string", "detail": "string", "severity": "high"|"medium"|"low"|"info" }], "perContributor": [{ "id": number, "label": "string", "note": "string", "suggestion": "string" }] }

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
        // Safety net: drop any timezone-related items even if the model ignores
        // the prompt rule that forbids them.
        items: this.stripTimezoneItems(parsed.items || []),
        // Re-label the AI's pseudonymous per-member notes back to real logins by
        // index. Any contributor the AI skipped gets a deterministic note.
        contributorInsights: this.buildContributorInsights(risk, parsed.perContributor),
        isFallback: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Workload AI generation failed, using deterministic fallback:", message);
      return this.deterministicFallback(risk, summary);
    }
  }

  /** Remove AI items that talk about timezones — the product intentionally does not surface them. */
  private stripTimezoneItems(items: WorkloadAiItem[]): WorkloadAiItem[] {
    const tzPattern = /time\s?zone|utc|local (time|hour)|non-utc/i;
    return items.filter((item) => !tzPattern.test(`${item.title} ${item.detail}`));
  }

  /**
   * Build one insight per real contributor. The AI writes notes against
   * pseudonyms + id; we resolve each back to the real login here (by id, then by
   * pseudonym label) and fall back to a deterministic note when the AI skipped a
   * person or the note is unusable.
   */
  private buildContributorInsights(
    risk: WorkloadRiskResult,
    aiPerContributor: unknown
  ): WorkloadContributorInsight[] {
    const aiList = Array.isArray(aiPerContributor) ? (aiPerContributor as Record<string, unknown>[]) : [];

    return risk.breakdown.map((b, idx) => {
      const match =
        aiList.find((x) => Number(x?.id) === idx) ??
        aiList.find((x) => typeof x?.label === "string" && x.label === pseudonymLabel(idx));

      const aiNote = typeof match?.note === "string" ? match.note.trim() : "";
      const aiSuggestion = typeof match?.suggestion === "string" ? match.suggestion.trim() : "";

      return {
        contributor: b.label,
        note: aiNote || this.defaultContributorNote(b),
        suggestion: aiSuggestion || undefined,
        totalEvents: b.totalEvents,
        offHoursEvents: b.offHoursEvents,
        commits: b.commits,
        reviews: b.reviews,
        night: b.night,
        weekend: b.weekend,
      };
    });
  }

  /** Deterministic, numbers-only per-member note (no AI, no ranking language). */
  private defaultContributorNote(b: WorkloadRiskResult["breakdown"][number]): string {
    const pct = b.totalEvents > 0 ? Math.round((b.offHoursEvents / b.totalEvents) * 100) : 0;
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    return (
      `Contributed ${plural(b.commits, "commit")} and ${plural(b.reviews, "review")}. ` +
      `${b.offHoursEvents} of ${b.totalEvents} (${pct}%) landed off-hours — ` +
      `${b.night} at night and ${b.weekend} on weekends (UTC).`
    );
  }

  private deterministicFallback(risk: WorkloadRiskResult, summary: string): WorkloadAiAnalysis {
    return {
      summary,
      confidence: "low",
      limitations: ["AI service unavailable, using deterministic rules.", WORKLOAD_LIMITATION],
      items: [
        {
          type: "risk_summary",
          title: "Sustained overtime is a burnout risk",
          detail:
            `${risk.aggregate.offHoursPct ?? 0}% of activity happened outside business hours ` +
            `(${risk.aggregate.nightCount} at night, ${risk.aggregate.weekendCount} on weekends, UTC). ` +
            "Maintaining this pattern tends to lead to fatigue and burnout, lower code quality with more bugs and rework, " +
            "slower long-term delivery, and higher turnover risk.",
          severity: risk.severity,
        },
        {
          type: "recommendation",
          title: "Rebalance workload and protect off-hours",
          detail:
            "Check whether deadlines or review load are pushing work into evenings and weekends. Rebalance tasks, " +
            "add backup reviewers for stale PRs, adjust scope or timelines, and set a team norm that protects nights " +
            "and weekends. Keep monitoring the off-hours trend so it does not become chronic.",
          severity: "info",
        },
        {
          type: "recommendation",
          title: "Protect delivery on urgent work without permanent crunch",
          detail:
            "When a deadline is genuinely tight, protect the timeline by cutting or deferring non-critical scope " +
            "(must-have vs nice-to-have), parallelizing work and adding temporary help, and unblocking the critical " +
            "path with fast reviews. Timebox any crunch to a short, explicitly agreed period, rotate who absorbs the " +
            "extra load, and schedule recovery time afterwards — short bursts can be acceptable, a permanent crunch is not.",
          severity: "info",
        },
      ],
      contributorInsights: this.buildContributorInsights(risk, undefined),
      isFallback: true,
    };
  }
}

export const workloadBurnoutService = new WorkloadBurnoutService();
