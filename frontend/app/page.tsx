import Link from "next/link";
import { ArrowRight, Activity, Users, Zap, Database } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fbf9f6] text-[#161616] py-8 px-6 sm:px-12 lg:px-20 flex flex-col justify-between">
      {/* Editorial Navbar */}
      <header className="max-w-5xl mx-auto w-full mb-12">
        <div className="serene-card px-7 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="serene-circle text-[#161616] w-10 h-10">
              <Zap className="w-4 h-4 text-[#15803d] fill-[#15803d]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-editorial font-normal text-xl text-[#161616] tracking-tight">NextGen</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6966]">Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="serene-btn-primary px-6 py-2.5 text-xs font-semibold tracking-wide flex items-center gap-2"
            >
              Candidate Portal
              <ArrowRight className="w-3.5 h-3.5 text-[#fbf9f6]" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-4xl mx-auto w-full py-10 flex flex-col items-center text-center justify-center">
        {/* Editorial Headline in Solid Deep Carbon Black */}
        <h1 className="font-editorial text-4xl sm:text-6xl font-normal text-[#161616] tracking-tight leading-[1.18] max-w-3xl">
          Real-Time Distributed <br />
          <span className="text-[#161616]">
            Examination & Coding Engine
          </span>
        </h1>

        {/* Humanist Body Prose */}
        <p className="mt-6 text-base sm:text-lg text-[#6b6966] max-w-2xl leading-relaxed font-normal">
          High-performance online test hosting powered by persistent WebSockets, multi-language compiler sandboxing, atomic MongoDB response upserts, and real-time candidate telemetry.
        </p>

        {/* Primary Call To Action */}
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/dashboard"
            className="serene-btn-primary px-8 py-3.5 text-sm font-semibold tracking-wide flex items-center gap-2.5 shadow-md"
          >
            Access Assessments Dashboard
            <ArrowRight className="w-4 h-4 text-[#fbf9f6]" />
          </Link>
        </div>

        {/* Feature Grid: Milled Alabaster Tactile Surfaces */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          {/* Card 1 */}
          <div className="serene-card p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="serene-circle text-[#161616] mb-5 w-11 h-11">
                <Activity className="w-5 h-5 text-[#15803d]" />
              </div>
              <h2 className="font-editorial text-lg font-normal text-[#161616] mb-2.5">
                Sub-Second Real-Time Updates
              </h2>
              <p className="text-[#6b6966] text-sm leading-relaxed font-normal">
                Every MCQ selection streams instantly over WebSockets to the supervisor dashboard without page refreshes or polling lag.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#e6e1d8]/70 flex items-center gap-1.5 text-xs text-[#15803d] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
              Continuous Socket Stream
            </div>
          </div>

          {/* Card 2 */}
          <div className="serene-card p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="serene-circle text-[#161616] mb-5 w-11 h-11">
                <Users className="w-5 h-5 text-[#15803d]" />
              </div>
              <h2 className="font-editorial text-lg font-normal text-[#161616] mb-2.5">
                500+ Virtualized DOM Matrix
              </h2>
              <p className="text-[#6b6966] text-sm leading-relaxed font-normal">
                Equipped with windowed DOM virtualization so supervisors can monitor 500+ concurrent students without browser stutter.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#e6e1d8]/70 flex items-center gap-1.5 text-xs text-[#15803d] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
              Zero Browser Stutter
            </div>
          </div>

          {/* Card 3 */}
          <div className="serene-card p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="serene-circle text-[#161616] mb-5 w-11 h-11">
                <Database className="w-5 h-5 text-[#15803d]" />
              </div>
              <h2 className="font-editorial text-lg font-normal text-[#161616] mb-2.5">
                Redis Pub/Sub Scaling
              </h2>
              <p className="text-[#6b6966] text-sm leading-relaxed font-normal">
                Integrated Redis pub/sub broker enables stateless horizontal node scaling behind load balancers with room isolation.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#e6e1d8]/70 flex items-center gap-1.5 text-xs text-[#15803d] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
              Clustered Fault Tolerance
            </div>
          </div>
        </div>
      </main>

      {/* Editorial Footer */}
      <footer className="max-w-5xl mx-auto w-full mt-16 py-6 border-t border-[#e6e1d8]/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6b6966]">
        <p className="font-normal">NextGen Test Portal • High-Concurrency Assessment Engine</p>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
          <span className="text-[#15803d] font-semibold">Cluster Operational</span>
        </div>
      </footer>
    </div>
  );
}
