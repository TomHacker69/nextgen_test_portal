"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ITest } from "@nextgen/shared-types";
import { BarChart3, Users, CheckCircle2, Clock, Award, HelpCircle, Loader2 } from "lucide-react";

export default function StatsPage() {
  return (
    <AuthGuard>
      <AdminLayout>
        <StatsContent />
      </AdminLayout>
    </AuthGuard>
  );
}

function StatsContent() {
  const [tests, setTests] = useState<ITest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [testStats, setTestStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/tests")
      .then((res) => {
        const list = res.data.tests || res.data || [];
        const safeList = Array.isArray(list) ? list : [];
        setTests(safeList);
        if (safeList.length > 0) {
          fetchStats(safeList[0]._id);
        }
      })
      .catch((_e: unknown) => {
        console.error("Failed to fetch tests:", _e);
        setTests([]);
      })
      .finally(() => setInitialLoading(false));
  }, []);

  async function fetchStats(testId: string) {
    if (!testId) return;
    setLoading(true);
    setSelectedTestId(testId);
    try {
      const res = await api.get(`/admin/tests/${testId}/stats`);
      setTestStats(res.data);
    } catch (e) {
      console.error("Failed to load stats:", e);
      setTestStats(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header & Test Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-2xl font-bold text-black tracking-tight">
            Assessment Analytics
          </h2>
          <p className="text-xs text-[#6b6966] mt-1">
            Question breakdown, candidate completion rates, and scoring distributions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedTestId}
            onChange={(e) => fetchStats(e.target.value)}
            className="serene-card-sm px-4 py-2 text-xs font-semibold bg-[#f5f2eb] border border-[#dbdad7] text-[#161616]"
          >
            <option value="">Choose an Assessment...</option>
            {tests.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title} ({t.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {initialLoading ? (
        <div className="p-12 text-center text-xs text-[#6b6966]">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#15803d]" />
          Loading analytics suites...
        </div>
      ) : loading ? (
        <div className="p-12 text-center text-xs text-[#6b6966]">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#15803d]" />
          Gathering live assessment statistics...
        </div>
      ) : !testStats ? (
        <div className="serene-card p-12 text-center border border-[#e6e1d8]">
          <BarChart3 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="font-semibold text-sm text-black">No Assessment Selected</p>
          <p className="text-xs text-[#6b6966]">
            Select an assessment from the dropdown above to inspect detailed analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Questions Count */}
            <div className="serene-card p-5 space-y-1.5 border border-[#e6e1d8]">
              <div className="flex items-center justify-between text-[#6b6966]">
                <span className="text-xs font-bold uppercase tracking-wider">Questions</span>
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="font-editorial text-3xl font-bold text-black">
                {testStats.questions?.length || 0}
              </div>
              <p className="text-[11px] text-[#6b6966]">Problem items in suite</p>
            </div>

            {/* Total Enrolled */}
            <div className="serene-card p-5 space-y-1.5 border border-[#e6e1d8]">
              <div className="flex items-center justify-between text-blue-700">
                <span className="text-xs font-bold uppercase tracking-wider">Candidates</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="font-editorial text-3xl font-bold text-blue-700">
                {testStats.participants?.length || 0}
              </div>
              <p className="text-[11px] text-[#6b6966]">Total roster size</p>
            </div>

            {/* Completed */}
            <div className="serene-card p-5 space-y-1.5 border border-[#e6e1d8]">
              <div className="flex items-center justify-between text-[#15803d]">
                <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="font-editorial text-3xl font-bold text-[#15803d]">
                {testStats.participants?.filter((p: any) => p.isCompleted).length || 0}
              </div>
              <p className="text-[11px] text-[#6b6966]">Final tests submitted</p>
            </div>

            {/* Average Score */}
            <div className="serene-card p-5 space-y-1.5 border border-[#e6e1d8]">
              <div className="flex items-center justify-between text-[#161616]">
                <span className="text-xs font-bold uppercase tracking-wider">Average Score</span>
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <div className="font-editorial text-3xl font-bold text-black">
                {typeof testStats.averageScore === "number"
                  ? `${Math.round(testStats.averageScore * 100)}%`
                  : "N/A"}
              </div>
              <p className="text-[11px] text-[#6b6966]">Across completed submissions</p>
            </div>
          </div>

          {/* Participant Scoring Roster */}
          <div className="serene-card p-6 border border-[#e6e1d8] space-y-4">
            <div className="flex items-center justify-between border-b border-[#e6e1d8] pb-3">
              <h3 className="font-editorial text-base font-bold text-black">
                Candidate Performance Breakdown
              </h3>
              <span className="text-xs text-[#6b6966]">
                Room: <strong className="font-mono text-black">{testStats.test?.roomId}</strong>
              </span>
            </div>

            {!testStats.participants || testStats.participants.length === 0 ? (
              <p className="text-xs text-[#6b6966] py-6 text-center">
                No participant records recorded for this assessment yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {testStats.participants.map((p: any, idx: number) => (
                  <div
                    key={p.userId || idx}
                    className="serene-card-sm p-4 flex items-center justify-between border border-[#e6e1d8]"
                  >
                    <div>
                      <div className="font-bold text-sm text-black">{p.userName || "Candidate"}</div>
                      <div className="text-xs text-[#6b6966] font-mono">{p.userEmail}</div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <span
                        className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                          p.isCompleted
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-blue-100 text-blue-800 border border-blue-300"
                        }`}
                      >
                        {p.isCompleted ? "Submitted" : "In Progress"}
                      </span>

                      {p.score !== undefined && (
                        <div className="text-right">
                          <span className="font-bold text-sm text-black">
                            {Math.round(p.score * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
