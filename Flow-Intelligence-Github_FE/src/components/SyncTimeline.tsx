import React from 'react';
import type { SyncRun } from '../types';

interface SyncTimelineProps {
  runs: SyncRun[];
}

const statusStyles: Record<string, { dot: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
  success: {
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'Success',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  running: {
    dot: 'bg-blue-500 animate-pulse',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Running',
    icon: (
      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  partial: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Partial',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  failed: {
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Failed',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

const typeStyles: Record<string, { bg: string; text: string }> = {
  initial: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  incremental: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  webhook: { bg: 'bg-violet-100', text: 'text-violet-700' },
};

export const SyncTimeline: React.FC<SyncTimelineProps> = ({ runs }) => {
  if (!runs.length) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium">No sync runs recorded yet</p>
        <p className="text-sm text-slate-400 mt-1">Trigger a sync to see history here</p>
      </div>
    );
  }

  const getDuration = (start: string, end?: string) => {
    if (!end) return 'In progress...';
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  return (
    <div className="space-y-3">
      {runs.map((run, index) => {
        const style = statusStyles[run.status] || statusStyles.success;
        const typeStyle = typeStyles[run.type] || typeStyles.incremental;
        const isLast = index === runs.length - 1;

        return (
          <div key={run.id} className="relative">
            {/* Timeline connector */}
            {!isLast && (
              <div className="absolute left-5 top-14 bottom-0 w-px bg-slate-200" />
            )}

            <div className="flex gap-4">
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className={`h-10 w-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center ${style.dot === 'bg-red-500' ? 'text-red-600' : 'text-green-600'}`}>
                  {style.icon}
                </div>
              </div>

              {/* Content card */}
              <div className={`flex-1 rounded-xl border ${style.bg} ${style.border} p-4 transition-all hover:shadow-sm`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Type badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${typeStyle.bg} ${typeStyle.text}`}>
                      {run.type === 'incremental' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {run.type === 'initial' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      {run.type === 'webhook' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
                        </svg>
                      )}
                      {run.type}
                    </span>

                    {/* Status badge */}
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      {style.label}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{getDuration(run.startedAt || '', run.finishedAt)}</span>
                    <span className="text-slate-300">|</span>
                    <span>{run.startedAt ? new Date(run.startedAt).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-200/50">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="font-medium">{(run.recordsProcessed ?? 0).toLocaleString()}</span>
                    <span className="text-slate-400">records</span>
                  </div>
                  {run.finishedAt && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Duration:</span>
                      <span className="font-medium">{getDuration(run.startedAt, run.finishedAt)}</span>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {run.warnings && run.warnings.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Warnings ({run.warnings.length})
                    </p>
                    <ul className="text-xs text-amber-600 space-y-0.5">
                      {run.warnings.slice(0, 3).map((warning, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="mt-1">•</span>
                          <span>{warning}</span>
                        </li>
                      ))}
                      {run.warnings.length > 3 && (
                        <li className="text-amber-500">+{run.warnings.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Error */}
                {run.errorMessage && (
                  <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Error
                    </p>
                    <p className="text-xs text-red-600">{run.errorMessage}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SyncTimeline;
