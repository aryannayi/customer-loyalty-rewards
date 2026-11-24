export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
          Phase 1 Complete
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Customer Loyalty Rewards System
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Factory box code engine with fraud prevention, rate limiting, and atomic reward redemptions.
        </p>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Customer Endpoints
            </h2>
            <ul className="text-xs font-mono space-y-1.5 text-slate-400">
              <li>
                <span className="text-emerald-400 font-semibold">POST</span> /api/codes/claim
              </li>
              <li>
                <span className="text-blue-400 font-semibold">GET</span> /api/customer?contact=...
              </li>
              <li>
                <span className="text-emerald-400 font-semibold">POST</span> /api/rewards/redeem
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Admin Endpoints (Requires x-admin-passcode)
            </h2>
            <ul className="text-xs font-mono space-y-1.5 text-slate-400">
              <li>
                <span className="text-emerald-400 font-semibold">POST</span> /api/admin/batches
              </li>
              <li>
                <span className="text-blue-400 font-semibold">GET</span> /api/admin/overview
              </li>
              <li>
                <span className="text-amber-400 font-semibold">PATCH</span> /api/admin/codes/[id]
              </li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-6 text-center">
          UI layer will be designed in Phase 2. Backend API and Prisma database layer are active.
        </p>
      </div>
    </main>
  )
}
