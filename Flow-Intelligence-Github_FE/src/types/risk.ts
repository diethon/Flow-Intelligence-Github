export interface EvidenceItem {
  entityType: string;
  entityId: string;
  label: string;
  githubUrl: string | null;
}

export interface EvidenceCard {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  summary: string;
  suggestedAction: string;
  confidence: "high" | "medium" | "low";
  limitation: string;
  evidence: EvidenceItem[];
  createdAt: string;
}

export interface RiskEvent {
  id: string;
  ruleCode: string;
  ruleName: string;
  ruleDescription: string;
  severity: "high" | "medium" | "low";
  status: "active" | "resolved" | "suppressed";
  metricValue: number;
  metricLabel: string;
  thresholdValue: number;
  thresholdUnit: string;
  isTriggered: boolean;
  windowStart: string;
  windowEnd: string;
  evidenceCard: EvidenceCard | null;
  createdAt: string;
}

export interface RiskEvaluationResult {
  repositoryId: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  overallRisk: "high" | "medium" | "low" | "good";
  triggeredCount: number;
  events: RiskEvent[];
  evaluatedAt: string;
}
