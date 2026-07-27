import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardRepositories } from '../api/dashboardApi';
import { ErrorAlert, PageShell, RepoSelect } from '../components/PageShell';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useRepositoryPredictions } from '../hooks/usePrediction';
import type {
  PredictionDetail,
  PredictionPullRequest,
  PredictionRiskLabel,
} from '../services/api/prediction';

interface PRPredictionsPageProps {
  repositoryId: string;
}

type RiskFilter = PredictionRiskLabel | 'all';

const RISK_ORDER: Record<PredictionRiskLabel, number> = { High: 3, Medium: 2, Low: 1 };
const RISK_STYLE: Record<PredictionRiskLabel, { bg: string; text: string; border: string; bar: string; soft: string }> = {
  High: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    bar: 'bg-rose-500',
    soft: 'bg-rose-100/70',
  },
  Medium: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    bar: 'bg-amber-500',
    soft: 'bg-amber-100/70',
  },
  Low: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-100/70',
  },
};

const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    try {
      return (JSON.parse(error.message) as { message?: string }).message ?? error.message;
    } catch {
      return error.message;
    }
  }
  return 'Could not load PR delay predictions.';
};

const asPercent = (value: number | undefined, digits = 0) =>
  `${Math.round((value ?? 0) * 100 * 10 ** digits) / 10 ** digits}%`;

const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'No timestamp';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getPr = (prediction: PredictionDetail): PredictionPullRequest | null => {
  return typeof prediction.pullRequestId === 'object' && prediction.pullRequestId !== null
    ? prediction.pullRequestId
    : null;
};

const getFeatureNumber = (prediction: PredictionDetail, ...keys: string[]) => {
  for (const key of keys) {
    const value = prediction.featureSummary?.[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
};

const getProbability = (prediction: PredictionDetail, label: PredictionRiskLabel) => {
  const key = label.toLowerCase();
  return prediction.probabilities?.[key] ?? prediction.probabilities?.[label] ?? 0;
};

function MetricTile({
  label,
  value,
  helper,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: 'slate' | 'rose' | 'amber' | 'emerald' | 'indigo';
}) {
  const toneClass = {
    slate: 'border-slate-200 bg-white text-slate-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  }[tone];

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-75">{helper}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: PredictionRiskLabel }) {
  const style = RISK_STYLE[risk];
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${style.bg} ${style.text} ${style.border}`}>
      {risk}
    </span>
  );
}

function ProbabilityStrip({ prediction }: { prediction: PredictionDetail }) {
  const low = getProbability(prediction, 'Low');
  const medium = getProbability(prediction, 'Medium');
  const high = getProbability(prediction, 'High');
  const total = low + medium + high || 1;
  const lowPct = (low / total) * 100;
  const mediumPct = (medium / total) * 100;
  const highPct = Math.max(0, 100 - lowPct - mediumPct);

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        <span className="bg-emerald-500" style={{ width: `${lowPct}%` }} />
        <span className="bg-amber-500" style={{ width: `${mediumPct}%` }} />
        <span className="bg-rose-500" style={{ width: `${highPct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-500">
        <span>L {asPercent(low, 0)}</span>
        <span>M {asPercent(medium, 0)}</span>
        <span>H {asPercent(high, 0)}</span>
      </div>
    </div>
  );
}

export const PRPredictionsPage: React.FC<PRPredictionsPageProps> = ({ repositoryId }) => {
  const navigate = useNavigate();
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const riskLabel = riskFilter === 'all' ? undefined : riskFilter;

  const reposQuery = useQuery({ queryKey: ['dashboard', 'repositories'], queryFn: fetchDashboardRepositories });
  const repos = reposQuery.data ?? [];
  const query = useRepositoryPredictions(repositoryId, { riskLabel, limit: 100 });

  const predictions = query.data?.predictions ?? [];
  const summary = query.data?.summary;

  const handleRepoChange = (id: string) => {
    if (!id || id === repositoryId) return;
    localStorage.setItem('selectedRepositoryId', id);
    window.dispatchEvent(new Event("repoChanged"));
    window.dispatchEvent(new Event("selectedRepoChanged"));
    window.dispatchEvent(new Event("selectedRepositoryChanged"));
    navigate(`/repositories/${id}/predictions`);
  };

  const derived = useMemo(() => {
    const sorted = [...predictions].sort((a, b) => {
      const byRisk = RISK_ORDER[b.riskLabel] - RISK_ORDER[a.riskLabel];
      if (byRisk !== 0) return byRisk;
      return b.probability - a.probability;
    });

    const watchlist = sorted.filter((p) => p.riskLabel !== 'Low').slice(0, 5);
    const highConfidence = predictions.filter((p) => p.probability >= 0.75).length;
    const needsReview = predictions.filter((p) => p.probability < 0.55).length;
    const totalChurn = predictions.reduce(
      (sum, p) => sum + getFeatureNumber(p, 'churn', 'additions') + getFeatureNumber(p, 'deletions'),
      0
    );
    const avgChurn = predictions.length ? Math.round(totalChurn / predictions.length) : 0;
    const avgFiles = predictions.length
      ? Math.round(predictions.reduce((sum, p) => sum + getFeatureNumber(p, 'changed_files', 'changedFiles'), 0) / predictions.length)
      : 0;
    const modelCounts = new Map<string, number>();
    for (const prediction of predictions) {
      const model =
        typeof prediction.modelVersionId === 'object'
          ? prediction.modelVersionId.version || prediction.modelVersionId.algorithm || 'unknown'
          : prediction.modelVersionId || prediction.modelVersion?.version || 'unknown';
      modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
    }

    return {
      sorted,
      watchlist,
      highConfidence,
      needsReview,
      avgChurn,
      avgFiles,
      modelCounts: Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [predictions]);

  const total = summary?.total ?? 0;
  const highCount = summary?.riskCounts.High ?? 0;
  const mediumCount = summary?.riskCounts.Medium ?? 0;
  const lowCount = summary?.riskCounts.Low ?? 0;
  const attentionRate = total ? (highCount + mediumCount) / total : 0;

  const riskTabs: { key: RiskFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'High', label: 'High', count: highCount },
    { key: 'Medium', label: 'Medium', count: mediumCount },
    { key: 'Low', label: 'Low', count: lowCount },
  ];

  return (
    <PageShell
      title="PR Delay Predictions"
      subtitle="Dedicated analysis of ML delay-risk predictions for open pull requests."
      actions={repos.length > 0 ? <RepoSelect repos={repos} value={repositoryId} onChange={handleRepoChange} /> : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/dashboard"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
        <Link
          to={`/repositories/${repositoryId}/evidence`}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          Prediction evidence
        </Link>
      </div>

      {query.isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12">
          <LoadingSpinner label="Loading PR delay predictions..." />
        </div>
      )}

      {query.isError && !query.isLoading && <ErrorAlert message={parseErrorMessage(query.error)} />}

      {query.isSuccess && summary && (
        <>
          {total === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-lg font-bold text-slate-800">No PR delay predictions yet</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                Predictions are generated after pull request sync runs for open PRs. Run a repository sync to create
                prediction records, then this page will show risk distribution, confidence and drivers.
              </p>
              <Link
                to={`/repositories/${repositoryId}/sync-status`}
                className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Open sync status
              </Link>
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Predicted PRs"
                  value={total}
                  helper="Total PRs with stored ML delay-risk predictions."
                  tone="indigo"
                />
                <MetricTile
                  label="Needs Attention"
                  value={asPercent(attentionRate, 0)}
                  helper={`${highCount + mediumCount} PRs are Medium or High risk.`}
                  tone={attentionRate >= 0.5 ? 'rose' : attentionRate >= 0.25 ? 'amber' : 'emerald'}
                />
                <MetricTile
                  label="Avg Confidence"
                  value={asPercent(summary.averageConfidence, 0)}
                  helper={`${derived.highConfidence} predictions are at least 75% confident.`}
                  tone="slate"
                />
                <MetricTile
                  label="Average PR Size"
                  value={derived.avgChurn}
                  helper={`${derived.avgFiles} changed files on average in this view.`}
                  tone="slate"
                />
              </section>

              <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Risk Distribution</h2>
                      <p className="text-sm text-slate-500">Breakdown across all stored predictions for this repository.</p>
                    </div>
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      Latest: {formatDate(summary.latestPredictedAt)}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {(['High', 'Medium', 'Low'] as PredictionRiskLabel[]).map((risk) => {
                      const count = summary.riskCounts[risk] ?? 0;
                      const pct = total ? count / total : 0;
                      const style = RISK_STYLE[risk];
                      return (
                        <div key={risk}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className={`font-bold ${style.text}`}>{risk}</span>
                            <span className="font-mono text-slate-500">{count} PRs · {asPercent(pct, 0)}</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900">Analysis Notes</h2>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <p>
                      Highest active signal:{' '}
                      <span className="font-semibold text-slate-900">{summary.highestRiskLabel ?? 'None'}</span>.
                    </p>
                    <p>
                      {derived.needsReview > 0
                        ? `${derived.needsReview} predictions have low confidence and should be reviewed manually.`
                        : 'No low-confidence predictions in the current view.'}
                    </p>
                    <p>
                      Treat Medium and High predictions as review-prioritization signals, not individual performance
                      scoring. The model uses PR metadata only.
                    </p>
                  </div>
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Model coverage</p>
                    <div className="mt-2 space-y-2">
                      {derived.modelCounts.length > 0 ? (
                        derived.modelCounts.map(([model, count]) => (
                          <div key={model} className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-mono text-xs text-slate-600">{model}</span>
                            <span className="font-semibold text-slate-800">{count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No model version data available.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900">Top Delay Drivers</h2>
                  <p className="mt-1 text-sm text-slate-500">Most common local explanation factors returned by the model.</p>
                  <div className="mt-4 space-y-3">
                    {summary.topFactors.length > 0 ? (
                      summary.topFactors.map((factor) => {
                        const width = Math.max(12, (factor.count / Math.max(1, predictions.length)) * 100);
                        return (
                          <div key={factor.factor}>
                            <div className="mb-1 flex justify-between gap-3 text-sm">
                              <span className="font-medium text-slate-700">{factor.factor}</span>
                              <span className="font-mono text-slate-500">{factor.count}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        No top factor data has been stored yet. New predictions will populate this when Python inference
                        returns `topFactors`.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900">Attention Watchlist</h2>
                  <p className="mt-1 text-sm text-slate-500">Medium and High risk PRs sorted by severity and confidence.</p>
                  <div className="mt-4 space-y-3">
                    {derived.watchlist.length > 0 ? (
                      derived.watchlist.map((prediction) => {
                        const pr = getPr(prediction);
                        return (
                          <div key={prediction._id ?? String(prediction.pullRequestId)} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {pr ? `#${pr.number} ${pr.title}` : 'Unknown pull request'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {getFeatureNumber(prediction, 'changed_files', 'changedFiles')} files ·{' '}
                                  {getFeatureNumber(prediction, 'additions')} added ·{' '}
                                  {getFeatureNumber(prediction, 'deletions')} deleted
                                </p>
                              </div>
                              <RiskBadge risk={prediction.riskLabel} />
                            </div>
                            <div className="mt-3">
                              <ProbabilityStrip prediction={prediction} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        No Medium or High risk PRs in this repository prediction set.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Prediction Records</h2>
                    <p className="text-sm text-slate-500">Filter by risk level and inspect each PR signal.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {riskTabs.map((tab) => {
                      const active = riskFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setRiskFilter(tab.key)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {tab.label}
                          <span className={`ml-2 font-mono text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {predictions.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">No predictions match this risk filter.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3">PR</th>
                          <th className="px-5 py-3">Risk</th>
                          <th className="px-5 py-3">Probability</th>
                          <th className="px-5 py-3">Size Signal</th>
                          <th className="px-5 py-3">Top Factor</th>
                          <th className="px-5 py-3">Predicted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {derived.sorted.map((prediction) => {
                          const pr = getPr(prediction);
                          const topFactor = prediction.topFactors?.[0];
                          return (
                            <tr key={prediction._id ?? `${String(prediction.pullRequestId)}-${prediction.predictedAt}`} className="hover:bg-slate-50/70">
                              <td className="max-w-[22rem] px-5 py-4">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {pr ? `#${pr.number} ${pr.title}` : 'Unknown pull request'}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {pr?.authorLogin || String(prediction.featureSummary.author || 'unknown author')}
                                  </p>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <RiskBadge risk={prediction.riskLabel} />
                              </td>
                              <td className="min-w-[12rem] px-5 py-4">
                                <ProbabilityStrip prediction={prediction} />
                              </td>
                              <td className="px-5 py-4 font-mono text-xs text-slate-600">
                                {getFeatureNumber(prediction, 'changed_files', 'changedFiles')} files<br />
                                +{getFeatureNumber(prediction, 'additions')} / -{getFeatureNumber(prediction, 'deletions')}
                              </td>
                              <td className="px-5 py-4 text-slate-600">
                                {topFactor ? (
                                  <span>
                                    {topFactor.factor}
                                    {typeof topFactor.strength === 'number' && (
                                      <span className="ml-1 font-mono text-xs text-slate-400">
                                        {topFactor.strength.toFixed(3)}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">No factor</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                                {formatDate(prediction.predictedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </PageShell>
  );
};

export default PRPredictionsPage;
