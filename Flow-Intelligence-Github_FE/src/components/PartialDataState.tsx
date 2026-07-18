export function PartialDataState({ message, missingData = [] }: { message: string, missingData?: string[] }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
      <span className="text-amber-500 text-lg flex-shrink-0">⚠</span>
      <div>
        <p className="text-sm font-semibold text-amber-800 leading-relaxed mb-1">{message}</p>
        {missingData.length > 0 && (
          <p className="text-xs text-amber-700">Missing: {missingData.join(", ")}</p>
        )}
      </div>
    </div>
  );
}
