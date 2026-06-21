import React from 'react';
import type { SyncStatus, SyncStatusJob } from '../types';

interface SyncStatusCardProps {
  status: SyncStatus;
  lastSyncAt: string;
  pendingJobs: number;
  currentRun?: {
    id: string;
    type: string;
    status: SyncStatus;
    startedAt: string;
    recordsProcessed: number;
    jobs?: SyncStatusJob[];
  } | null;
}

const statusStyles: Record<SyncStatus, { bg: string; text: string; label: string; dot: string }> = {
  running: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    label: 'Running',
    dot: 'bg-blue-500',
  },
  success: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    label: 'Success',
    dot: 'bg-green-500',
  },
  partial: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: 'Partial',
    dot: 'bg-amber-500',
  },
  failed: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    label: 'Failed',
    dot: 'bg-red-500',
  },
};

const jobLabels: Record<string, string> = {
  sync_pull_requests: 'Đồng bộ Pull Requests',
  sync_reviews: 'Đồng bộ Đánh giá (Reviews)',
  sync_review_requests: 'Đồng bộ Yêu cầu Review',
  sync_commits: 'Đồng bộ Lịch sử Commits',
  sync_issues: 'Đồng bộ Issues',
  sync_check_runs: 'Đồng bộ CI/CD Checks',
};

export const SyncStatusCard: React.FC<SyncStatusCardProps> = ({
  status,
  lastSyncAt,
  pendingJobs,
  currentRun,
}) => {
  const style = statusStyles[status] || statusStyles.success;
  const isRunning = status === 'running';

  const renderJobStatusIcon = (jobStatus: SyncStatusJob['status']) => {
    switch (jobStatus) {
      case 'completed':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 shrink-0">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        );
      case 'processing':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 animate-spin shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </span>
        );
      case 'failed':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        );
      default: // pending
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        );
    }
  };

  const getJobStatusTextColor = (jobStatus: SyncStatusJob['status']) => {
    switch (jobStatus) {
      case 'completed': return 'text-slate-700';
      case 'processing': return 'text-blue-700 font-medium';
      case 'failed': return 'text-red-700 font-medium';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className={`rounded-xl border ${style.bg} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Status
        </h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.text}`}>
          <span className={`h-2 w-2 rounded-full ${style.dot} ${isRunning ? 'animate-pulse' : ''}`} />
          {style.label}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Last sync</span>
          <span className="text-sm font-medium text-slate-900">
            {new Date(lastSyncAt).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Pending jobs</span>
          <span className="text-lg font-bold text-slate-900">{pendingJobs}</span>
        </div>

        <div className="h-2 w-full rounded-full bg-white/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isRunning ? 'bg-blue-500 animate-pulse' : status === 'success' ? 'bg-green-500' : status === 'partial' ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, 100 - pendingJobs * 5))}%` }}
          />
        </div>
      </div>

      {currentRun && (
        <div className="mt-4 pt-4 border-t border-slate-200/50">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600 mb-2">
            <span className="font-semibold">Current run details:</span>
            <span className="px-2 py-0.5 bg-white/50 rounded capitalize text-[10px]">{currentRun.type}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 mb-4 bg-white/30 p-2 rounded-lg">
            <span className="capitalize font-medium">{currentRun.status}</span>
            <span>•</span>
            <span>{currentRun.recordsProcessed} records</span>
            <span>•</span>
            <span>{new Date(currentRun.startedAt).toLocaleTimeString()}</span>
          </div>

          {currentRun.jobs && currentRun.jobs.length > 0 && (
            <div className="space-y-2 mt-3 bg-white/40 p-3 rounded-lg border border-slate-200/20">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Chi tiết tác vụ đồng bộ:
              </p>
              <div className="space-y-2.5">
                {currentRun.jobs.map((job) => (
                  <div key={job.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      {renderJobStatusIcon(job.status)}
                      <span className={`${getJobStatusTextColor(job.status)} truncate`}>
                        {jobLabels[job.jobType] || job.jobType}
                      </span>
                    </div>
                    {job.status === 'failed' && job.error && (
                      <p className="ml-7 text-[10px] text-red-500 italic max-w-full truncate" title={job.error}>
                        Lỗi: {job.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SyncStatusCard;
