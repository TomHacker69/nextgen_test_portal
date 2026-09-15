import Link from "next/link";
import { ArrowRight, ShieldCheck, Activity, Users, Zap, Database } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">NextGen</span>
              <span className="text-cyan-400 font-semibold text-lg ml-1">Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition shadow-md shadow-cyan-500/25 flex items-center gap-2"
            >
              Portal Login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-16 flex flex-col items-center text-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          Engineered for 500+ Concurrent Test-Takers
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
          Real-Time Distributed <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
            MCQ Assessment Engine
          </span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          High-performance online test hosting powered by persistent WebSockets, Redis pub/sub clustering, atomic MongoDB response upserts, and a real-time virtualized admin monitoring matrix.
        </p>

        {/* Quick Access CTA Buttons */}
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-base transition shadow-xl shadow-cyan-500/25 flex items-center gap-2"
          >
            Access Portal
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/admin"
            className="px-8 py-3.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 font-medium text-base transition flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            Admin Dashboard
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Sub-Second Real-Time Updates</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every MCQ selection streams instantly over Socket.IO to the supervisor dashboard without page refreshes or polling lag.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">500+ Virtualized DOM Matrix</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Equipped with windowed DOM virtualization so supervisors can monitor 500+ concurrent students without browser stutter.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Database className="w-6 h-6" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Redis Pub/Sub Scaling</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Integrated Socket.IO Redis adapter enables stateless horizontal node scaling behind load balancers with room isolation.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        NextGen Test Portal • High-Concurrency Assessment Engine
      </footer>
    </div>
  );
}
