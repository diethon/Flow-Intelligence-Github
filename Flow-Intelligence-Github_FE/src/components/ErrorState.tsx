import { ErrorAlert } from "./PageShell";

export function ErrorState({ title = "An error occurred", message, retryAction }: { title?: string; message: string; retryAction?: () => void }) {
  return (
    <div className="flex flex-col gap-3 py-6">
      <ErrorAlert message={`${title}: ${message}`} />
      {retryAction && (
        <button
          onClick={retryAction}
          className="self-start text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
