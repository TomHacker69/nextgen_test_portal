"use client";

import { useEffect, useState, useRef, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getSocket } from "@/lib/socket";
import {
  ShieldCheck,
  ArrowLeft,
  Users,
  CheckCircle,
  Activity,
  Search,
  Wifi,
  WifiOff,
  Filter,
  BarChart3,
  Clock,
  Sparkles,
} from "lucide-react";
import { ILiveParticipantRow, AdminLiveUpdatePayload, UserCompletedPayload } from "@/types";

interface ITestMeta {
  _id: string;
  title: string;
  roomId: string;
  status: string;
  durationMinutes: number;
}

interface IQuestionMeta {
  _id: string;
  order: number;
  text: string;
}

export default function AdminLiveDashboardPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const router = useRouter();
  const { testId } = use(params);

  const [test, setTest] = useState<ITestMeta | null>(null);
  const [questions, setQuestions] = useState<IQuestionMeta[]>([]);
  const [participants, setParticipants] = useState<Record<string, ILiveParticipantRow>>({});
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "done">("all");
  const [recentUpdatedUserId, setRecentUpdatedUserId] = useState<string | null>(null);

  // Load initial test snapshot
  useEffect(() => {
    let isMounted = true;

    async function loadSnapshot() {
      try {
        const res = await fetch(`/api/admin/tests/${testId}/stats`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (isMounted && data.test) {
          setTest(data.test);
          setQuestions(data.questions || []);

          const partMap: Record<string, ILiveParticipantRow> = {};
          (data.participants || []).forEach((p: ILiveParticipantRow) => {
            partMap[p.userId] = p;
          });
          setParticipants(partMap);
        }
      } catch (err) {
        console.error("Failed to load initial snapshot:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, [testId, router]);

  // Connect to Socket.IO & join admin room
  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setSocketConnected(true);
      socket.emit("admin:join", testId);
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onLiveUpdate(payload: AdminLiveUpdatePayload) {
      if (payload.testId !== testId) return;

      setParticipants((prev) => {
        const existing = prev[payload.userId] || {
          userId: payload.userId,
          name: payload.userName,
          email: payload.userEmail,
          roomId: "",
          currentQuestionIndex: 0,
          totalQuestions: questions.length,
          answers: {},
          isCompleted: false,
          isOnline: true,
        };

        const updatedAnswers = {
          ...existing.answers,
          [payload.questionId]: payload.selectedOption,
        };

        const answeredCount = Object.keys(updatedAnswers).length;
        const isDone =
          payload.isFinal ||
          (questions.length > 0 && answeredCount >= questions.length);

        return {
          ...prev,
          [payload.userId]: {
            ...existing,
            currentQuestionIndex: answeredCount,
            answers: updatedAnswers,
            lastAnsweredAt: payload.answeredAt,
            isCompleted: isDone,
            isOnline: true,
          },
        };
      });

      // Highlight the active row briefly
      setRecentUpdatedUserId(payload.userId);
      setTimeout(() => setRecentUpdatedUserId(null), 1500);
    }

    function onUserCompleted(payload: UserCompletedPayload) {
      if (payload.testId !== testId) return;

      setParticipants((prev) => {
        const existing = prev[payload.userId];
        if (!existing) return prev;

        return {
          ...prev,
          [payload.userId]: {
            ...existing,
            isCompleted: true,
            lastAnsweredAt: payload.completedAt,
          },
        };
      });
    }

    if (socket.connected) {
      onConnect();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("admin:update", onLiveUpdate);
    socket.on("user:completed", onUserCompleted);

    return () => {
      socket.emit("admin:leave", testId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("admin:update", onLiveUpdate);
      socket.off("user:completed", onUserCompleted);
    };
  }, [testId, questions.length]);

  // Filtered participants list
  const participantList = useMemo(() => {
    return Object.values(participants);
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    return participantList.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "in_progress") return !p.isCompleted;
      if (statusFilter === "done") return p.isCompleted;
      return true;
    });
  }, [participantList, searchQuery, statusFilter]);

  // Aggregate Metrics
  const totalEnrolled = participantList.length;
  const completedCount = participantList.filter((p) => p.isCompleted).length;
  const inProgressCount = participantList.filter(
    (p) => !p.isCompleted && Object.keys(p.answers).length > 0
  ).length;

  const totalPossibleAnswers = totalEnrolled * (questions.length || 1);
  const totalSubmittedAnswers = participantList.reduce(
    (acc, cur) => acc + Object.keys(cur.answers).length,
    0
  );
  const averageProgress = totalPossibleAnswers
    ? Math.round((totalSubmittedAnswers / totalPossibleAnswers) * 100)
    : 0;

  // Virtualizer for smooth 500+ rows rendering
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredParticipants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-xl border border-slate-800 hover:bg-slate-800/80 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">
                  {test?.title || "Live Test Monitoring"}
                </span>
                {test && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded">
                    Room: {test.roomId}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 block -mt-0.5">
                Real-Time Socket.IO Cluster Synchronization
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {socketConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 live-pulse" />
                <Wifi className="w-3.5 h-3.5" />
                <span>Live Socket Stream Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Connecting to WebSocket...</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col">
        {/* Real-time KPI Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Enrolled Candidates</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{totalEnrolled}</div>
            <span className="text-[11px] text-slate-500">Assigned to {test?.roomId}</span>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Actively Submitting</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400 mt-2">{inProgressCount}</div>
            <span className="text-[11px] text-slate-500">Real-time answers streaming</span>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Completed (Done)</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-2">{completedCount}</div>
            <span className="text-[11px] text-slate-500">Final submissions recorded</span>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Cohort Average Progress</span>
              <BarChart3 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{averageProgress}%</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${averageProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by candidate name or email..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === "all"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              All ({totalEnrolled})
            </button>
            <button
              onClick={() => setStatusFilter("in_progress")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === "in_progress"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              In Progress ({inProgressCount})
            </button>
            <button
              onClick={() => setStatusFilter("done")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === "done"
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Done ({completedCount})
            </button>
          </div>
        </div>

        {/* Virtualized Matrix Table Container */}
        <div className="flex-1 glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <div className="col-span-4">Candidate Information</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Progress</div>
            <div className="col-span-3">Live Answer Matrix (Q1 - Q{questions.length})</div>
            <div className="col-span-1 text-right">Last Activity</div>
          </div>

          {/* Virtualized Body */}
          <div
            ref={parentRef}
            className="flex-1 overflow-auto max-h-[580px] divide-y divide-slate-800/60"
          >
            {filteredParticipants.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-sm">
                No candidates match the current filter or search criteria.
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const participant = filteredParticipants[virtualRow.index];
                  const answeredCount = Object.keys(participant.answers).length;
                  const percent = questions.length
                    ? Math.round((answeredCount / questions.length) * 100)
                    : 0;
                  const isRecentlyUpdated = recentUpdatedUserId === participant.userId;

                  return (
                    <div
                      key={participant.userId}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className={`grid grid-cols-12 gap-4 px-6 items-center text-xs transition-colors duration-300 ${
                        isRecentlyUpdated
                          ? "bg-cyan-500/15 border-y border-cyan-500/30"
                          : "hover:bg-slate-900/50"
                      }`}
                    >
                      {/* Candidate Name & Email */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs flex-shrink-0">
                          {participant.name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-white truncate flex items-center gap-1.5">
                            {participant.name}
                            {isRecentlyUpdated && (
                              <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] truncate font-mono">
                            {participant.email}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="col-span-2">
                        {participant.isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Done
                          </span>
                        ) : answeredCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                            <Activity className="w-3 h-3 animate-pulse" />
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800/80 text-slate-400">
                            <Clock className="w-3 h-3" />
                            Waiting
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="col-span-2">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400 font-mono">
                            {answeredCount}/{questions.length}
                          </span>
                          <span className="font-semibold text-white">{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              participant.isCompleted ? "bg-emerald-400" : "bg-cyan-400"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Live Answers Matrix */}
                      <div className="col-span-3 flex items-center gap-1 overflow-x-auto py-1">
                        {questions.map((q, idx) => {
                          const answer = participant.answers[q._id];
                          return (
                            <div
                              key={q._id}
                              title={`Q${idx + 1}: ${answer ? answer.toUpperCase() : "Unanswered"}`}
                              className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-[10px] transition-all flex-shrink-0 ${
                                answer
                                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                                  : "bg-slate-900 border border-slate-800 text-slate-600"
                              }`}
                            >
                              {answer ? answer.toUpperCase() : "-"}
                            </div>
                          );
                        })}
                      </div>

                      {/* Timestamp */}
                      <div className="col-span-1 text-right text-[11px] text-slate-400 font-mono">
                        {participant.lastAnsweredAt
                          ? new Date(participant.lastAnsweredAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : "--:--:--"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
