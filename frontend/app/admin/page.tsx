"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Play,
  Clock,
  Users,
  FileQuestion,
  Radio,
  Plus,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface ITestItem {
  _id: string;
  title: string;
  scheduledStartTime: string;
  durationMinutes: number;
  status: "scheduled" | "live" | "ended";
  roomId: string;
  studentCount: number;
  questionCount: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [tests, setTests] = useState<ITestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Test Modal State
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newRoomId, setNewRoomId] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newStartTime, setNewStartTime] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTests = async () => {
    try {
      const res = await fetch("/api/admin/tests");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.tests) {
        setTests(data.tests);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load tests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
    const interval = setInterval(fetchTests, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStartTest = async (testId: string) => {
    setStartingId(testId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tests/${testId}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start test");

      // Refresh list
      await fetchTests();
      // Redirect to live dashboard
      router.push(`/admin/live/${testId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStartingId(null);
    }
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          roomId: newRoomId,
          durationMinutes: parseInt(newDuration, 10),
          scheduledStartTime: newStartTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create test");

      setShowModal(false);
      setNewTitle("");
      setNewRoomId("");
      await fetchTests();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col">
      {/* Admin Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight">Admin Console</span>
              <span className="text-xs text-slate-400 block -mt-0.5">Test Management & Live Dispatcher</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              Schedule Test
            </button>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-lg border border-slate-800 hover:bg-slate-800/80 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Scheduled & Active Tests</h1>
            <p className="text-sm text-slate-400 mt-1">
              Start scheduled sessions and monitor concurrent student submissions in real time
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Persistent Node Server • Socket.IO Cluster Ready</span>
          </div>
        </div>

        {/* Tests Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
            <p className="text-sm">Loading test schedules...</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800">
            <FileQuestion className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h2 className="text-white font-medium text-base">No tests created yet</h2>
            <p className="text-slate-400 text-sm mt-1 mb-6">
              Create your first scheduled MCQ test or run the database seeder.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition"
            >
              Schedule New Test
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tests.map((test) => {
              const scheduledDate = new Date(test.scheduledStartTime);
              const isPastTime = Date.now() >= scheduledDate.getTime();
              const isLive = test.status === "live";
              const isEnded = test.status === "ended";

              return (
                <div
                  key={test._id}
                  className={`glass-panel rounded-2xl p-6 border transition-all ${
                    isLive
                      ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 live-pulse" />
                            LIVE NOW
                          </span>
                        ) : isEnded ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            CONCLUDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                            <Clock className="w-3.5 h-3.5" />
                            SCHEDULED
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                          Room: {test.roomId}
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-white leading-snug">{test.title}</h2>
                    </div>
                  </div>

                  {/* Metadata chips */}
                  <div className="grid grid-cols-3 gap-3 my-5 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Scheduled</span>
                      <span className="text-slate-200 font-medium">
                        {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Duration</span>
                      <span className="text-slate-200 font-medium">{test.durationMinutes} mins</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Candidates</span>
                      <span className="text-slate-200 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        {test.studentCount}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
                    {isLive ? (
                      <Link
                        href={`/admin/live/${test._id}`}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                      >
                        <Radio className="w-4 h-4 animate-pulse" />
                        Open Live Monitor Matrix
                      </Link>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartTest(test._id)}
                          disabled={startingId === test._id}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 disabled:opacity-50"
                        >
                          {startingId === test._id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Starting Test...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              Start Test {isPastTime ? "(Time Reached)" : "(Manual Override)"}
                            </>
                          )}
                        </button>

                        <Link
                          href={`/admin/live/${test._id}`}
                          className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                          title="Preview Live Dashboard"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* New Test Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Schedule New Assessment</h2>
            <form onSubmit={handleCreateTest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Test Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Distributed Systems Final"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Unique Room Identifier (Room ID)
                </label>
                <input
                  type="text"
                  required
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  placeholder="e.g. ROOM-DS-2026"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400 uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Scheduled Start
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {creating ? "Scheduling..." : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
