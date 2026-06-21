import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardPage, ConnectRepositoryPage, SyncStatusPage, LoginPage, PullRequestsPage } from './pages';
import { RiskEvidencePage, EvidenceCardDetailPage } from './pages';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { AppLayout } from './components/AppLayout.js';
import { ReviewCIMetricsPage } from "./pages/ReviewCIMetricsPage.js";
import { RulebookPage } from "./pages/RulebookPage.js";
import { RiskPage } from "./pages/RiskPage.js";
import { ComingSoon } from "./pages/ComingSoon.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  useEffect(() => {
    if (token) {
      localStorage.setItem('accessToken', token);
      window.location.href = '/dashboard';
    } else if (error) {
      console.error('Auth error:', error);
      window.location.href = '/login';
    }
  }, [token, error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Authenticating...</p>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/repositories/connect"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="px-4 sm:px-6 py-5 sm:py-8">
                    <ConnectRepositoryPage />
                  </div>
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repositories/:id/sync-status"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="px-4 sm:px-6 py-5 sm:py-8">
                    <SyncStatusPageWrapper />
                  </div>
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repositories/:id/pull-requests"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="px-4 sm:px-6 py-5 sm:py-8">
                    <PullRequestsPageWrapper />
                  </div>
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/review-ci"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReviewCIMetricsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rulebook"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <RulebookPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/risk"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <RiskPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/brief"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ComingSoon title="AI Weekly Brief" owner="Anh Quân" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/privacy"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ComingSoon title="Privacy Settings" owner="Anh Quân" />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repositories/:id/risk-evidence"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="px-4 sm:px-6 py-5 sm:py-8">
                    <RiskEvidencePageWrapper />
                  </div>
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repositories/:id/risk-evidence/:cardId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="px-4 sm:px-6 py-5 sm:py-8">
                    <EvidenceCardDetailPageWrapper />
                  </div>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

const SyncStatusPageWrapper = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/repositories/connect" replace />;
  }
  return <SyncStatusPage repositoryId={id} />;
};

const PullRequestsPageWrapper = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/repositories/connect" replace />;
  }
  return <PullRequestsPage />;
};

const RiskEvidencePageWrapper = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <Navigate to="/repositories/connect" replace />;
  }
  return <RiskEvidencePage repositoryId={id} />;
};

const EvidenceCardDetailPageWrapper = () => {
  const { id, cardId } = useParams<{ id: string, cardId: string }>();
  if (!id || !cardId) {
    return <Navigate to="/repositories/connect" replace />;
  }
  return <EvidenceCardDetailPage repositoryId={id} cardId={cardId} />;
};

export default App;
