"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { ITest } from "@nextgen/shared-types";
import {
  Users,
  UserPlus,
  Shield,
  Clock,
  CheckCircle2,
  Ban,
  Plus,
  Loader2,
  Radio,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle,
  Hourglass,
  Sparkles,
} from "lucide-react";

export default function UsersPage() {
  return (
    <AuthGuard>
      <AdminLayout>
        <LiveProctoringContent />
      </AdminLayout>
    </AuthGuard>
  );
}

function LiveProctoringContent() {
  const [tests, setTests] = useState<ITest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [enrolledUsers, setEnrolledUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // Enroll form state
  const [emailsInput, setEmailsInput] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("User@123456");
  const [enrolling, setEnrolling] = useState(false);

  // 1. Initial Load of Tests
  useEffect(() => {
    fetchTests();
  }, []);

  async function fetchTests() {
    setLoading(true);
    try {
      const res = await api.get("/admin/tests");
      const list = res.data.tests || res.data || [];
      setTests(list);
      if (list.length > 0) {
        setSelectedTestId(list[0]._id);
        fetchUsersForTest(list[0]._id);
      }
    } catch (e) {
      console.error("Failed to load tests:", e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsersForTest(testId: string) {
    try {
      const res = await api.get(`/admin/tests/${testId}/users`);
      setEnrolledUsers(res.data.users || []);
    } catch (e) {
      console.error("Failed to load users:", e);
      setEnrolledUsers([]);
    }
  }

  // 2. Real-Time Socket.IO Synchronous Telemetry Subscription
  useEffect(() => {
    if (!selectedTestId) return;
    const socket = getSocket();
    socket.emit("admin:join", selectedTestId);

    const handleRoster = (roster: any[]) => {
      if (Array.isArray(roster)) {
        setEnrolledUsers(roster);
      }
    };

    const handleCandidateLive = (data: any) => {
      if (!data?.userId) return;
      setEnrolledUsers((prev) =>
        prev.map((u) => {
          const uId = u.userId?._id || u.userId;
          if (uId === data.userId) {
            return {
              ...u,
              isOnline: data.isOnline !== undefined ? data.isOnline : u.isOnline,
              currentQuestionIndex:
                data.currentQuestionIndex !== undefined
                  ? data.currentQuestionIndex
                  : u.currentQuestionIndex,
              lastActiveAt: data.lastActiveAt || u.lastActiveAt,
              answersCount:
                data.answersCount !== undefined ? data.answersCount : u.answersCount,
              score: data.score !== undefined ? data.score : u.score,
            };
          }
          return u;
        })
      );
    };

    socket.on("admin:roster" as any, handleRoster);
    socket.on("admin:candidatePresence" as any, handleCandidateLive);
    socket.on("admin:candidateLive" as any, handleCandidateLive);

    return () => {
      socket.off("admin:roster" as any, handleRoster);
      socket.off("admin:candidatePresence" as any, handleCandidateLive);
      socket.off("admin:candidateLive" as any, handleCandidateLive);
      socket.emit("admin:leave", selectedTestId);
    };
  }, [selectedTestId]);

  // 3. Synchronous Live Seconds Counter Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setEnrolledUsers((prev) =>
        prev.map((u) => {
          if (u.status === "completed" || u.status === "blocked") return u;
          return {
            ...u,
            timeRemainingSeconds: Math.max(0, (u.timeRemainingSeconds ?? 0) - 1),
            timeSpentSeconds: (u.timeSpentSeconds ?? 0) + 1,
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format countdown string
  function formatSeconds(sec: number): string {
    if (sec === undefined || sec === null) return "--";
    if (sec <= 0) return "00:00 (Expired)";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Live Proctor Actions
  async function handleGrantExtraTime(userId: string, minutes: number) {
    if (!selectedTestId) return;
    try {
      await api.post(`/admin/tests/${selectedTestId}/users/${userId}/extra-time`, {
        extraMinutes: minutes,
      });
      await fetchUsersForTest(selectedTestId);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to grant extra time");
    }
  }

  async function handleBlockUser(userId: string, name: string) {
    if (!confirm(`Are you sure you want to block candidate "${name}"? They will be immediately disconnected.`)) return;
    try {
      await api.post(`/admin/tests/${selectedTestId}/users/${userId}/block`);
      await fetchUsersForTest(selectedTestId);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to block candidate");
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTestId) return;

    const emails = emailsInput
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) {
      alert("Please enter at least one valid candidate email.");
      return;
    }

    setEnrolling(true);
    try {
      await api.post(`/admin/tests/${selectedTestId}/users`, {
        emails,
        defaultPassword,
      });
      setEmailsInput("");
      setShowEnrollModal(false);
      await fetchUsersForTest(selectedTestId);
    } catch (err: any) {
      console.error("Failed to enroll:", err);
      alert(err?.response?.data?.error || "Failed to enroll candidates");
    } finally {
      setEnrolling(false);
    }
  }

  const activeTest = tests.find((t) => t._id === selectedTestId);
  const onlineCount = enrolledUsers.filter((u) => u.isOnline).length;
  const inProgressCount = enrolledUsers.filter((u) => u.status === "in_progress").length;
  const completedCount = enrolledUsers.filter((u) => u.status === "completed").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-editorial text-2xl font-bold text-black tracking-tight">
              Live Candidate Chamber & Proctoring
            </h2>
            <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              SYNCHRONOUS
            </span>
          </div>
          <p className="text-xs text-[#6b6966] mt-1">
            Real-time candidate telemetry, live individual timers, room allocations, and proctor interventions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Test Selector */}
          <select
            value={selectedTestId}
            onChange={(e) => {
              setSelectedTestId(e.target.value);
              fetchUsersForTest(e.target.value);
            }}
            className="serene-card-sm px-3.5 py-2 text-xs font-semibold bg-[#f5f2eb] border border-[#dbdad7] text-[#161616]"
          >
            {tests.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title} ({t.roomId})
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowEnrollModal(true)}
            className="serene-btn-primary px-4 py-2 text-xs font-semibold gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" /> Enroll Candidates
          </button>
        </div>
      </div>

      {/* Live Synchronous Telemetry KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Enrolled */}
        <div className="serene-card p-4 space-y-1 border border-[#e6e1d8]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b6966]">
            Total Enrolled
          </span>
          <div className="font-editorial text-2xl font-bold text-black">
            {enrolledUsers.length}
          </div>
          <span className="text-[10px] text-[#6b6966]">Candidates in roster</span>
        </div>

        {/* Live Online Users */}
        <div className="serene-card p-4 space-y-1 border border-[#e6e1d8]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Connected Online
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="font-editorial text-2xl font-bold text-emerald-700">
            {onlineCount}
          </div>
          <span className="text-[10px] text-emerald-800/80">Active socket sessions</span>
        </div>

        {/* In Progress */}
        <div className="serene-card p-4 space-y-1 border border-[#e6e1d8]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
            Writing Exam
          </span>
          <div className="font-editorial text-2xl font-bold text-blue-700">
            {inProgressCount}
          </div>
          <span className="text-[10px] text-blue-800/80">Active test timers</span>
        </div>

        {/* Completed */}
        <div className="serene-card p-4 space-y-1 border border-[#e6e1d8]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#161616]">
            Completed
          </span>
          <div className="font-editorial text-2xl font-bold text-black">
            {completedCount}
          </div>
          <span className="text-[10px] text-[#6b6966]">Submitted assessments</span>
        </div>
      </div>

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="serene-card p-6 border border-[#e6e1d8] space-y-4">
          <div className="flex items-center justify-between border-b border-[#e6e1d8] pb-3">
            <h3 className="font-editorial text-lg font-bold text-black flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" /> Enroll Candidates into Room{" "}
              <span className="font-mono text-black">{activeTest?.roomId}</span>
            </h3>
            <button
              onClick={() => setShowEnrollModal(false)}
              className="text-xs text-[#6b6966] hover:text-black"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleEnroll} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6b6966] mb-1">
                Candidate Emails (separated by commas or newlines)
              </label>
              <textarea
                rows={3}
                required
                value={emailsInput}
                onChange={(e) => setEmailsInput(e.target.value)}
                placeholder="student1@university.edu&#10;student2@university.edu"
                className="w-full p-3 bg-[#fbf9f6] border border-[#e6e1d8] rounded-xl text-xs font-mono text-[#161616] focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6b6966] mb-1">
                Initial Default Password
              </label>
              <input
                type="text"
                required
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                className="w-full p-2.5 bg-[#fbf9f6] border border-[#e6e1d8] rounded-xl text-xs font-mono text-[#161616] focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="serene-btn-secondary px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={enrolling}
                className="serene-btn-primary px-5 py-2 text-xs font-semibold gap-1.5"
              >
                {enrolling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enrolling...
                  </>
                ) : (
                  <>Enroll Candidates</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Live Candidates Roster */}
      <div className="serene-card p-6 border border-[#e6e1d8] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e6e1d8] pb-3">
          <div>
            <h3 className="font-editorial text-lg font-bold text-black">
              Live Roster & Individual Timings ({enrolledUsers.length})
            </h3>
            <p className="text-xs text-[#6b6966] mt-0.5">
              Live telemetry tracking connected students, active question indices, and time-remaining.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b6966]">
            <span>Active Room:</span>
            <span className="font-mono font-bold px-2.5 py-1 rounded-full bg-[#ece7df] text-black border border-[#dbdad7]">
              {activeTest?.roomId || "N/A"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#6b6966]">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#15803d]" />
            Loading live candidate telemetry...
          </div>
        ) : enrolledUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6b6966] border border-dashed border-[#e6e1d8] rounded-2xl">
            No candidates enrolled in this assessment yet. Click &ldquo;Enroll Candidates&rdquo; to add students.
          </div>
        ) : (
          <div className="space-y-3">
            {enrolledUsers.map((item, idx) => {
              const u = item.userId && typeof item.userId === "object" ? item.userId : item;
              const uid = u._id || item.userId || item.accessId;
              const isOnline = Boolean(item.isOnline);
              const remainingSec = item.timeRemainingSeconds ?? 0;
              const isUrgent = remainingSec > 0 && remainingSec <= 300; // < 5 mins
              const isExpired = remainingSec <= 0 && item.status !== "not_started";

              return (
                <div
                  key={item._id || item.accessId || idx}
                  className={`serene-card-sm p-4 border transition ${
                    isOnline
                      ? "border-emerald-300 bg-[#f5f8f5]"
                      : "border-[#e6e1d8] bg-[#f5f2eb]"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Candidate Identity & Online Dot */}
                    <div className="flex items-center gap-3.5 min-w-[240px]">
                      <div className="relative">
                        <div className="serene-circle w-10 h-10 font-bold text-sm text-black">
                          {item.name ? item.name[0]?.toUpperCase() : "C"}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                          }`}
                          title={isOnline ? "Candidate is Online & Connected" : "Offline"}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-black">
                            {item.name || u.name || "Candidate"}
                          </span>
                          {isOnline ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Wifi className="w-2.5 h-2.5" /> ONLINE
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-1">
                              <WifiOff className="w-2.5 h-2.5" /> OFFLINE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6b6966] font-mono mt-0.5">
                          {item.email || u.email}
                        </div>
                      </div>
                    </div>

                    {/* Middle-1: Room & Progress */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      {/* Room */}
                      <div>
                        <span className="text-[10px] font-bold text-[#6b6966] uppercase block">
                          Connected Room
                        </span>
                        <span className="font-mono font-bold text-black">
                          {item.roomId || u.roomId || activeTest?.roomId || "N/A"}
                        </span>
                      </div>

                      {/* Current Action */}
                      <div>
                        <span className="text-[10px] font-bold text-[#6b6966] uppercase block">
                          Active Question
                        </span>
                        <span className="font-bold text-black flex items-center gap-1">
                          <Activity className="w-3 h-3 text-[#15803d]" />
                          Q#{item.currentQuestionIndex || 1} of 30
                        </span>
                      </div>

                      {/* Answered / Score */}
                      <div>
                        <span className="text-[10px] font-bold text-[#6b6966] uppercase block">
                          Answers / Score
                        </span>
                        <span className="font-semibold text-black">
                          {item.answersCount ?? 0} answered ·{" "}
                          <strong className="text-emerald-700">{item.score ?? 0} pts</strong>
                        </span>
                      </div>
                    </div>

                    {/* Middle-2: Live Synchronous Countdown */}
                    <div className="flex flex-col items-start lg:items-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b6966] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#15803d]" /> Individual Time Remaining
                      </span>
                      <div
                        className={`font-mono text-base font-bold mt-0.5 ${
                          isUrgent
                            ? "text-red-600 animate-pulse"
                            : isExpired
                            ? "text-slate-500 line-through"
                            : "text-black"
                        }`}
                      >
                        {formatSeconds(remainingSec)}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase mt-1 ${
                          item.status === "completed"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                            : item.status === "in_progress"
                            ? "bg-blue-100 text-blue-900 border border-blue-200"
                            : item.status === "blocked"
                            ? "bg-red-100 text-red-900 border border-red-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {item.status || "not_started"}
                      </span>
                    </div>

                    {/* Right: Live Proctor Actions */}
                    <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#e6e1d8]">
                      {/* Extra Time */}
                      <button
                        onClick={() => handleGrantExtraTime(uid, 5)}
                        className="serene-btn-secondary px-2.5 py-1.5 text-[11px] font-semibold text-black"
                        title="Grant 5 Extra Minutes to candidate"
                      >
                        +5m
                      </button>
                      <button
                        onClick={() => handleGrantExtraTime(uid, 10)}
                        className="serene-btn-secondary px-2.5 py-1.5 text-[11px] font-semibold text-black"
                        title="Grant 10 Extra Minutes to candidate"
                      >
                        +10m
                      </button>

                      {/* Block Candidate */}
                      {item.blocked || item.status === "blocked" ? (
                        <span className="text-xs font-bold text-red-700 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200">
                          BLOCKED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleBlockUser(uid, item.name || "Candidate")}
                          className="serene-circle w-8 h-8 text-[#6b6966] hover:text-red-600 hover:bg-red-50 transition"
                          title="Block Candidate (Disconnect immediately)"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
