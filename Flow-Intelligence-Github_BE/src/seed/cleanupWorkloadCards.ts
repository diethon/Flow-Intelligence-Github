/**
 * One-off cleanup: remove Workload Risk Evidence Cards that were persisted into
 * the shared `evidenceCards` collection before Workload Risk became a
 * page-local (non-persisted) signal. Safe to re-run.
 *
 * Run: npx tsx src/seed/cleanupWorkloadCards.ts
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { EvidenceCard } from '../models/EvidenceCard';

const run = async (): Promise<void> => {
  await connectDatabase();
  const res = await EvidenceCard.deleteMany({ title: /^Workload Risk:/ });
  console.log(`Deleted ${res.deletedCount} Workload Risk evidence card(s).`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Cleanup failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
