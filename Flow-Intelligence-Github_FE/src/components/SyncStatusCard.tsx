import React from 'react';
import type { SyncStatus } from '../types';

interface SyncStatusCardProps {
  status: SyncStatus;
  lastSyncAt: string;
  pendingJobs: number;
  currentRun?: {
    type: string;
    status: SyncStatus;
    startedAt: string;
    recordsProcessed: number;
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

export const SyncStatusCard: React.FC<SyncStatusCardProps> = ({
  status,
  lastSyncAt,
  pendingJobs,
  currentRun,
}) => {
  const style = statusStyles[status] || statusStyles.success;
  const isRunning = status === 'running';

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
          <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
            <span className="font-semibold">Current run:</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="px-2 py-0.5 bg-white/50 rounded capitalize">{currentRun.type}</span>
            <span>•</span>
            <span className="capitalize">{currentRun.status}</span>
            <span>•</span>
            <span>{currentRun.recordsProcessed} records</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Started: {new Date(currentRun.startedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default SyncStatusCard;
