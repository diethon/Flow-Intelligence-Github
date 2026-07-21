/**
 * Canonical EvidenceCard model lives in ./EvidenceCard. This file is kept as a
 * thin re-export so existing imports (`evidenceCard.model`) keep working while
 * only a single mongoose model is registered for the `evidenceCards` collection.
 */
export { EvidenceCard } from './EvidenceCard';
export type { IEvidenceCard, IEvidenceItem } from './EvidenceCard';
