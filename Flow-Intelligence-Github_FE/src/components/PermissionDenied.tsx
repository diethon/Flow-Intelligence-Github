export function PermissionDenied() {
  return (
    <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
      <h1 className="text-xl font-bold text-amber-900">You do not have permission</h1>
      <p className="mt-2 text-sm text-amber-800">
        Repository Leader or Global Admin access is required for this feature.
      </p>
    </div>
  );
}

