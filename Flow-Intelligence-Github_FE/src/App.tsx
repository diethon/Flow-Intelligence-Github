import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardPage, SyncStatusPage, LoginPage, PullRequestsPage } from './pages';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Layout } from './components/Layout';

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
      window.location.href = '/repositories/connect';
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
          <Route path="/" element={<Navigate to="/repositories/connect" replace />} />
          <Route
            path="/repositories/connect"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repositories/:id/sync-status"
            element={
              <ProtectedRoute>
                <SyncStatusPageWrapper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/repositories/:id/pull-requests"
            element={
              <ProtectedRoute>
                <PullRequestsPageWrapper />
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

export default App;
