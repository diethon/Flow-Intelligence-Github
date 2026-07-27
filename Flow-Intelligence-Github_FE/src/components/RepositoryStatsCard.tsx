import React from 'react';
import type { RepositoryDetails } from '../types';

interface RepositoryStatsCardProps {
  details: RepositoryDetails;
}

const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-500',
  Python: 'bg-green-500',
  Java: 'bg-red-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Ruby: 'bg-red-600',
  PHP: 'bg-purple-500',
  'C++': 'bg-pink-500',
  C: 'bg-gray-500',
  Swift: 'bg-orange-400',
  Kotlin: 'bg-purple-600',
  Dart: 'bg-blue-400',
  HTML: 'bg-orange-600',
  CSS: 'bg-blue-300',
  Shell: 'bg-green-600',
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  color: string;
}> = ({ icon, label, value, trend, color }) => (
  <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-sm transition-shadow">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-2xl font-bold text-slate-900 truncate">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {trend && <p className="text-xs text-green-600 mt-0.5">{trend}</p>}
    </div>
  </div>
);

export const RepositoryStatsCard: React.FC<RepositoryStatsCardProps> = ({ details }) => {
  const { stats, languages, topContributors } = details;

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Repository Overview
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={
              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            }
            label="Stars"
            value={stats.stars.toLocaleString()}
            color="bg-yellow-50"
          />
          <StatCard
            icon={
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            }
            label="Forks"
            value={stats.forks.toLocaleString()}
            color="bg-slate-50"
          />
          <StatCard
            icon={
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
            label="Watchers"
            value={stats.watchers.toLocaleString()}
            color="bg-blue-50"
          />
          <StatCard
            icon={
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            label="Open Issues"
            value={stats.openIssues.toLocaleString()}
            color="bg-red-50"
          />
          <StatCard
            icon={
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="Open PRs"
            value={stats.openPullRequests.toLocaleString()}
            color="bg-green-50"
          />
          <StatCard
            icon={
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            label="Contributors"
            value={stats.contributors.toLocaleString()}
            color="bg-purple-50"
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branches & Languages */}
        <div className="space-y-6">
          {/* Branches */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Branches
              <span className="ml-auto text-xs font-normal text-slate-500">{stats.branches.length} total</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {stats.branches.slice(0, 12).map((branch) => (
                <span
                  key={branch}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ${
                    branch === stats.defaultBranch
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {branch}
                  {branch === stats.defaultBranch && (
                    <span className="text-indigo-400 ml-0.5">★</span>
                  )}
                </span>
              ))}
              {stats.branches.length > 12 && (
                <span className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg">
                  +{stats.branches.length - 12} more
                </span>
              )}
            </div>
          </div>

          {/* Languages */}
          {Object.keys(languages).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Languages
              </h4>
              <div className="space-y-3">
                {Object.entries(languages)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([lang, percent]) => (
                    <div key={lang} className="flex items-center gap-3">
                      <span
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${languageColors[lang] || 'bg-slate-400'}`}
                      />
                      <span className="text-sm text-slate-700 font-medium min-w-[80px]">{lang}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${languageColors[lang] || 'bg-slate-400'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-500 font-medium w-12 text-right">{percent}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Contributors */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Top Contributors
            <span className="ml-auto text-xs font-normal text-slate-500">{stats.contributors} total</span>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {topContributors.slice(0, 8).map((contributor, index) => (
              <a
                key={`${contributor.login}-${index}`}
                href={`https://github.com/${contributor.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group"
              >
                <img
                  src={contributor.avatar_url}
                  alt={contributor.login}
                  className="w-10 h-10 rounded-full ring-2 ring-white shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                    {contributor.login}
                  </p>
                  <p className="text-xs text-slate-500">
                    {contributor.contributions.toLocaleString()} commits
                  </p>
                </div>
              </a>
            ))}
          </div>
          {topContributors.length > 8 && (
            <p className="mt-4 text-center text-sm text-slate-500">
              +{topContributors.length - 8} more contributors
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepositoryStatsCard;
