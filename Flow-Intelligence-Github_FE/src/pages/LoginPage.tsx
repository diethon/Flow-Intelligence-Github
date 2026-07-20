import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/axiosClient';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleGitHubLogin = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/auth/github');
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to get GitHub auth URL:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Flow Intelligence</h1>
          <p className="text-slate-500 mt-1">GitHub Repository Sync</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-medium text-slate-900 mb-1 text-center">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6 text-center">Sign in with your GitHub account</p>

          <button
            onClick={handleGitHubLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <span>Redirecting to GitHub...</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>Sign in with GitHub</span>
              </>
            )}
          </button>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-2">Want to use a different account?</p>
            <a
              href="https://github.com/logout"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out of GitHub on browser to switch account
            </a>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
