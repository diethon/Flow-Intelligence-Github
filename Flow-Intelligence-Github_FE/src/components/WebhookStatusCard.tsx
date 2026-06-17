import React from 'react';

interface WebhookStatusCardProps {
  lastEventReceivedAt?: string;
  lastEventType?: string;
  lastEventAction?: string;
  unprocessedCount: number;
}

const healthStyles = {
  healthy: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
    icon: '✓',
  },
  degraded: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    icon: '!',
  },
  critical: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
    icon: '×',
  },
};

export const WebhookStatusCard: React.FC<WebhookStatusCardProps> = ({
  lastEventReceivedAt,
  lastEventType,
  lastEventAction,
  unprocessedCount,
}) => {
  const health = unprocessedCount > 100 ? 'critical' : unprocessedCount > 50 ? 'degraded' : 'healthy';
  const style = healthStyles[health];

  return (
    <div className={`rounded-xl border ${style.bg} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Webhook Health
        </h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.text}`}>
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {health === 'healthy' ? 'Healthy' : health === 'degraded' ? 'Degraded' : 'Critical'}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Last received</p>
            <p className="text-sm font-medium text-slate-900">
              {lastEventReceivedAt ? new Date(lastEventReceivedAt).toLocaleString() : 'N/A'}
            </p>
            {lastEventType && (
              <p className="text-xs text-slate-500 mt-0.5">
                {lastEventType} {lastEventAction ? `• ${lastEventAction}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Unprocessed events</span>
            <span className="text-lg font-bold text-slate-900">{unprocessedCount}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                health === 'healthy' ? 'bg-green-500' : health === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, 100 - unprocessedCount * 0.5))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookStatusCard;
