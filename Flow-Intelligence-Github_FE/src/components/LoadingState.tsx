import { Spinner } from "./PageShell";

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 bg-white rounded-xl border border-slate-200">
      <Spinner size={24} color="#6366f1" />
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}
