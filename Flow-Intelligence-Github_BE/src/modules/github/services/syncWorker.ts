import mongoose from 'mongoose';
import { SyncJobRepository } from '../repositories/repositories';
import { SyncJobProcessor } from '../services/syncJobProcessor.service';
import { SyncJob } from '../models';

const syncJobRepo = new SyncJobRepository();
const processor = new SyncJobProcessor();

const POLL_INTERVAL = 5000;

export async function startSyncWorker(): Promise<void> {
  console.log('[SyncWorker] Starting sync job worker...');

  async function pollJobs(): Promise<void> {
    try {
      const pendingJobs = await SyncJob.find({
        status: 'pending',
        runAfter: { $lte: new Date() },
      })
        .sort({ runAfter: 1 })
        .limit(1)
        .lean();

      if (pendingJobs.length > 0) {
        const job = pendingJobs[0];
        console.log(`[SyncWorker] Processing job: ${job._id} (${job.jobType})`);

        try {
          await processor.processJob(job._id.toString());
          console.log(`[SyncWorker] Job completed: ${job._id}`);
        } catch (error) {
          console.error(`[SyncWorker] Job failed: ${job._id}`, error);
        }
      }
    } catch (error) {
      console.error('[SyncWorker] Poll error:', error);
    }
  }

  setInterval(pollJobs, POLL_INTERVAL);

  pollJobs();
}
