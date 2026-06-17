import React from 'react';
import type { RepositoryDetails } from '../types';

interface RepositoryDetailsCardProps {
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

export const RepositoryDetailsCard: React.FC<RepositoryDetailsCardProps> = ({ details }) => {
  const { stats, languages, topContributors } = details;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-900">
            <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {stats.stars}
          </div>
          <p className="text-xs text-slate-500 mt-1">Stars</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-900">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {stats.forks}
          </div>
          <p className="text-xs text-slate-500 mt-1">Forks</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-900">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {stats.watchers}
          </div>
          <p className="text-xs text-slate-500 mt-1">Watchers</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-900">
            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {stats.openIssues}
          </div>
          <p className="text-xs text-slate-500 mt-1">Open Issues</p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-slate-900">
            <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {stats.openPullRequests}
          </div>
          <p className="text-xs text-slate-500 mt-1">Open PRs</p>
        </div>
      </div>

      {/* Branches */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">
          Branches ({stats.branches.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          {stats.branches.map((branch) => (
            <span
              key={branch}
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                branch === stats.defaultBranch
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {branch}
              {branch === stats.defaultBranch && ' (default)'}
            </span>
          ))}
        </div>
      </div>

      {/* Languages */}
      {Object.keys(languages).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Languages</h4>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(languages)
              .sort(([, a], [, b]) => b - a)
              .map(([lang, percent]) => (
                <div key={lang} className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${languageColors[lang] || 'bg-slate-400'}`}
                  />
                  <span className="text-sm text-slate-600">
                    {lang} <span className="text-slate-400">({percent}%)</span>
                  </span>
                </div>
              ))}
          </div>
          {/* Language bar */}
          <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden flex">
            {Object.entries(languages)
              .sort(([, a], [, b]) => b - a)
              .map(([lang, percent]) => (
                <div
                  key={lang}
                  className={`h-full ${languageColors[lang] || 'bg-slate-400'}`}
                  style={{ width: `${percent}%` }}
                  title={`${lang}: ${percent}%`}
                />
              ))}
          </div>
        </div>
      )}

      {/* Contributors */}
      {topContributors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">
            Top Contributors ({stats.contributors})
          </h4>
          <div className="flex flex-wrap gap-3">
            {topContributors.slice(0, 10).map((contributor) => (
              <a
                key={contributor.login}
                href={`https://github.com/${contributor.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <img
                  src={contributor.avatar_url}
                  alt={contributor.login}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm font-medium text-slate-700">
                  {contributor.login}
                </span>
                <span className="text-xs text-slate-400">
                  {contributor.contributions} commits
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RepositoryDetailsCard;
