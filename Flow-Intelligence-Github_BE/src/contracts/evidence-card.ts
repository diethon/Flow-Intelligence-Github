export interface EvidenceCardDTO {
  repositoryId: string;
  riskEventId?: string;     // null if sourceType='ml'
  predictionId?: string;    // null if sourceType='rule'
  sourceType: 'rule' | 'ml';
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  evidence: Array<{
    label: string;
    value: string | number;
  }>;
  confidence: number | string; // 0.0-1.0 or 'high'|'medium'|'low'
  limitation: string;
  suggestedAction: string;
  createdAt: Date;
}
