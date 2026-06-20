import React from 'react';

interface RepositoryConnectionPanelProps {
  onSubmit: (payload: { token: string; owner: string; repo: string }) => void;
  isValidating?: boolean;
  validationError?: string | null;
}

export const RepositoryConnectionPanel: React.FC<RepositoryConnectionPanelProps> = ({
  onSubmit,
  isValidating,
  validationError,
}) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      token: String(formData.get('token') || ''),
      owner: String(formData.get('owner') || ''),
      repo: String(formData.get('repo') || ''),
    };
    onSubmit(payload);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium text-gray-700">GitHub Token</label>
        <input
          type="password"
          name="token"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          placeholder="ghp_..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Owner</label>
          <input
            type="text"
            name="owner"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            placeholder="facebook"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Repository</label>
          <input
            type="text"
            name="repo"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            placeholder="react"
          />
        </div>
      </div>

      {validationError && <p className="text-sm text-red-600">{validationError}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isValidating}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isValidating ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </form>
  );
};
