"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ITest } from "@nextgen/shared-types";
import Link from "next/link";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  ListChecks,
  Radio,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <AdminLayout>
        <DashboardContent />
      </AdminLayout>
    </AuthGuard>
  );
}

function DashboardContent() {
  const [tests, setTests] = useState<ITest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/tests")
      .then((res) => {
        const list = res.data.tests || res.data || [];
        setTests(Array.isArray(list) ? list : []);
      })
      .catch((err) => setError(err?.response?.data?.error || err?.message || "Failed to load tests"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#6b6966]">
        Loading dashboard metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
        {error}
      </div>
    );
  }

  const stats = {
    total: tests.length,
    scheduled: tests.filter((t) => t.status === "scheduled").length,
    live: tests.filter((t) => t.status === "live").length,
    ended: tests.filter((t) => t.status === "ended").length,
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Title */}
      <div>
        <h2 className="font-editorial text-2xl font-bold text-black tracking-tight">
          Executive Overview
        </h2>
        <p className="text-xs text-[#6b6966] mt-1">
          Real-time assessment chamber metrics, active sessions, and proctoring status.
        </p>
      </div>

      {/* KPI Metrics in Neumorphic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Tests */}
        <div className="serene-card p-6 space-y-2 border border-[#e6e1d8]">
          <div className="flex items-center justify-between text-[#6b6966]">
            <span className="text-xs font-bold uppercase tracking-wider">Total Tests</span>
            <div className="serene-circle w-8 h-8 text-[#161616]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="font-editorial text-3xl font-bold text-black">{stats.total}</div>
          <p className="text-[11px] text-[#6b6966]">Configured assessment suites</p>
        </div>

        {/* Live Sessions */}
        <div className="serene-card p-6 space-y-2 border border-[#e6e1d8]">
          <div className="flex items-center justify-between text-[#15803d]">
            <span className="text-xs font-bold uppercase tracking-wider">Active Live</span>
            <div className="serene-circle w-8 h-8 text-[#15803d]">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="font-editorial text-3xl font-bold text-[#15803d]">{stats.live}</div>
          <p className="text-[11px] text-[#6b6966]">Sessions receiving live events</p>
        </div>

        {/* Scheduled */}
        <div className="serene-card p-6 space-y-2 border border-[#e6e1d8]">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-bold uppercase tracking-wider">Scheduled</span>
            <div className="serene-circle w-8 h-8 text-blue-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="font-editorial text-3xl font-bold text-blue-700">{stats.scheduled}</div>
          <p className="text-[11px] text-[#6b6966]">Pending arrival time</p>
        </div>

        {/* Ended */}
        <div className="serene-card p-6 space-y-2 border border-[#e6e1d8]">
          <div className="flex items-center justify-between text-[#6b6966]">
            <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
            <div className="serene-circle w-8 h-8 text-[#6b6966]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="font-editorial text-3xl font-bold text-[#6b6966]">{stats.ended}</div>
          <p className="text-[11px] text-[#6b6966]">Historical records archived</p>
        </div>
      </div>

      {/* Recent Tests Table in Neumorphic Card */}
      <div className="serene-card p-6 space-y-4 border border-[#e6e1d8]">
        <div className="flex items-center justify-between border-b border-[#e6e1d8] pb-4">
          <div>
            <h3 className="font-editorial text-lg font-bold text-black">
              Assessment Suites
            </h3>
            <p className="text-xs text-[#6b6966]">
              Manage test schedules, questions, and launch live monitoring consoles.
            </p>
          </div>
          <Link
            href="/tests"
            className="serene-btn-secondary px-4 py-2 text-xs font-semibold gap-1.5"
          >
            Manage All <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {tests.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6b6966]">
            No assessment suites found. Click &ldquo;Manage All&rdquo; to create your first test.
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map((test) => (
              <div
                key={test._id}
                className="serene-card-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#e6e1d8]"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-black">{test.title}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        test.status === "live"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : test.status === "ended"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-blue-100 text-blue-800 border border-blue-300"
                      }`}
                    >
                      {test.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6b6966]">
                    <span>Room: <strong className="font-mono text-[#161616]">{test.roomId}</strong></span>
                    <span>Duration: {test.durationMinutes} mins</span>
                    <span>Questions: {test.questions?.length || 0}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/tests`}
                    className="serene-btn-secondary px-3 py-1.5 text-xs font-semibold gap-1"
                  >
                    <ListChecks className="w-3.5 h-3.5 text-[#15803d]" /> Questions
                  </Link>

                  <Link
                    href={`/tests/${test._id}/live`}
                    className="serene-btn-primary px-3.5 py-1.5 text-xs font-semibold gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5 text-emerald-400" /> Live Proctor
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
