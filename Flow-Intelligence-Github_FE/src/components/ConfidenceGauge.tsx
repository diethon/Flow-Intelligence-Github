import React from 'react';
import type { EvidenceConfidence } from '../types';
import { CONFIDENCE_LEVEL } from './evidenceMeta';

interface ConfidenceGaugeProps {
  confidence: EvidenceConfidence;
  /** `inline` for the compact list-row reading, `block` for the detail panel. */
  variant?: 'inline' | 'block';
}

/**
 * Confidence shown as a discrete 3-segment reading with an explicit text label —
 * the model's certainty is made visible, not buried.
 */
export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({ confidence, variant = 'inline' }) => {
  const level = CONFIDENCE_LEVEL[confidence];
  const segments = (
    <span className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-colors ${variant === 'block' ? 'w-6' : 'w-3'} ${
            i <= level ? 'bg-slate-900' : 'bg-slate-200'
          }`}
        />
      ))}
    </span>
  );

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1.5" title={`${confidence} confidence`}>
        {segments}
        <span className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
          {confidence}
        </span>
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Confidence</span>
        <span className="font-mono text-xs uppercase tracking-wide text-slate-700">{confidence}</span>
      </div>
      <div className="mt-2">{segments}</div>
    </div>
  );
};
