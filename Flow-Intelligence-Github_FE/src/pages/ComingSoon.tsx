export function ComingSoon({ title, owner }: { title: string; owner?: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl mx-auto mb-5">
          🚧
        </div>
        <h2 className="text-lg font-semibold text-slate-300 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Under construction.{owner && ` Being built by ${owner}.`}
        </p>
      </div>
    </div>
  );
}
