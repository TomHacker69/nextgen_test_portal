"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Clock,
  FileQuestion,
  Code2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RotateCcw,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Hash,
} from "lucide-react";

interface IAssessment {
  _id: string;
  title: string;
  roomId: string;
  durationMinutes: number;
  status: "draft" | "scheduled" | "live" | "completed";
  scheduledStartTime?: string;
  totalQuestions: number;
  mcqCount: number;
  codingCount: number;
  answersCount: number;
  isCompleted: boolean;
  score: number;
  isUserRoom: boolean;
}

interface UserProfile {
  userId: string;
  email: string;
  roomId?: string;
}

export default function CandidateDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assessments, setAssessments] = useState<IAssessment[]>([]);
  const [roomFilter, setRoomFilter] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/test");

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load assessments");
      }

      setProfile(data.user);
      setAssessments(data.assessments || []);
    } catch (err: any) {
      setError(err.message || "Failed to load assessments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      router.push("/login");
    }
  };

  const handleResetTest = async (testId: string, testTitle: string) => {
    if (
      !window.confirm(
        `Are you sure you want to reset your attempt for "${testTitle}"? This will clear previous submissions so you can take the examination from the beginning.`
      )
    ) {
      return;
    }

    try {
      setResettingId(testId);
      const res = await fetch(`/api/test/${testId}/reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset");
      }

      await fetchAssessments();
    } catch (err: any) {
      alert(err.message || "Failed to reset assessment");
    } finally {
      setResettingId(null);
    }
  };

  const filteredAssessments = assessments.filter((a) => {
    if (!roomFilter.trim()) return true;
    const term = roomFilter.toLowerCase().trim();
    return (
      a.roomId.toLowerCase().includes(term) ||
      a.title.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#fbf9f6] text-[#161616] py-8 px-6 sm:px-12 lg:px-20 flex flex-col justify-between font-body">
      {/* Header */}
      <header className="max-w-6xl mx-auto w-full mb-10">
        <div className="serene-card px-7 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="serene-circle text-[#161616] w-10 h-10">
              <Zap className="w-4 h-4 text-[#15803d] fill-[#15803d]" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-editorial font-normal text-xl text-[#161616] tracking-tight">
                  NextGen
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6966]">
                  Candidate Portal
                </span>
              </div>
              {profile && (
                <div className="text-[11px] text-[#6b6966]">
                  Logged in as <span className="font-semibold text-[#161616]">{profile.email}</span>
                  {profile.roomId && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#ece7df] text-[#161616] font-mono text-[10px] font-bold">
                      {profile.roomId}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eef7ee] border border-[#15803d]/20 text-xs font-semibold text-[#15803d]">
              <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
              Live Telemetry Synchronized
            </div>

            <button
              onClick={handleLogout}
              className="serene-btn-secondary px-4 py-2 text-xs font-semibold tracking-wide flex items-center gap-1.5 hover:text-red-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full flex-1">
        {/* Banner Section */}
        <div className="mb-10 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ece7df] text-xs font-semibold text-[#6b6966] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#15803d]" />
            Available Assessments & Examination Chambers
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-normal text-[#161616] tracking-tight">
            Select Your Examination
          </h1>
          <p className="mt-2 text-[#6b6966] text-sm sm:text-base max-w-2xl leading-relaxed">
            Choose an assigned assessment chamber below to enter the live proctored environment. Your answers, code snapshots, and timer are synchronously saved.
          </p>
        </div>

        {/* Room Filter Bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="serene-inset px-3.5 py-2 flex items-center gap-2 w-full sm:w-80">
              <Hash className="w-4 h-4 text-[#6b6966]" />
              <input
                type="text"
                placeholder="Search test title or Room ID..."
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="bg-transparent text-xs sm:text-sm text-[#161616] focus:outline-none w-full placeholder-[#8c8883]"
              />
            </div>
            {roomFilter && (
              <button
                onClick={() => setRoomFilter("")}
                className="text-xs text-[#6b6966] hover:text-[#161616] underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-xs text-[#6b6966]">
            Showing <strong className="text-[#161616]">{filteredAssessments.length}</strong> available test{filteredAssessments.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-[#161616] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-[#6b6966]">Loading available assessments...</p>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="serene-card p-12 text-center">
            <div className="serene-circle w-14 h-14 mx-auto mb-4 text-[#6b6966]">
              <FileQuestion className="w-6 h-6" />
            </div>
            <h3 className="font-editorial text-xl font-normal text-[#161616] mb-2">
              No Assessments Found
            </h3>
            <p className="text-sm text-[#6b6966] max-w-md mx-auto">
              There are currently no active or scheduled examinations matching your room credentials. Contact your test administrator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAssessments.map((test) => {
              const isLive = test.status === "live";
              const isScheduled = test.status === "scheduled";
              const isCompleted = test.isCompleted;
              const hasStarted = test.answersCount > 0 && !isCompleted;

              return (
                <div
                  key={test._id}
                  className={`serene-card p-7 flex flex-col justify-between transition-all duration-200 hover:shadow-lg ${
                    isLive ? "ring-1 ring-[#15803d]/30" : ""
                  }`}
                >
                  <div>
                    {/* Status Pill & Room ID */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eef7ee] border border-[#15803d]/30 text-[11px] font-bold text-[#15803d]">
                            <span className="w-2 h-2 rounded-full bg-[#15803d] animate-ping" />
                            LIVE NOW
                          </span>
                        ) : isScheduled ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fff8e6] border border-[#d97706]/30 text-[11px] font-bold text-[#b45309]">
                            <Clock className="w-3 h-3" />
                            SCHEDULED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3f4f6] text-[11px] font-bold text-[#6b7280]">
                            {test.status.toUpperCase()}
                          </span>
                        )}

                        <span className="px-2.5 py-0.5 rounded-md bg-[#ece7df] text-[#161616] font-mono text-[11px] font-bold">
                          {test.roomId}
                        </span>
                      </div>

                      {test.isUserRoom && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#15803d] bg-[#eef7ee] px-2 py-0.5 rounded">
                          Your Room
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="font-editorial text-xl font-normal text-[#161616] mb-3 leading-snug">
                      {test.title}
                    </h2>

                    {/* Metadata Breakdown */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#ece7df]/60 border border-[#e6e1d8] mb-5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#6b6966]" />
                        <div>
                          <div className="text-[10px] uppercase text-[#6b6966] font-medium">Duration</div>
                          <div className="text-xs font-semibold text-[#161616]">{test.durationMinutes} mins</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <FileQuestion className="w-4 h-4 text-[#6b6966]" />
                        <div>
                          <div className="text-[10px] uppercase text-[#6b6966] font-medium">Questions</div>
                          <div className="text-xs font-semibold text-[#161616]">{test.totalQuestions} items</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-[#6b6966]" />
                        <div>
                          <div className="text-[10px] uppercase text-[#6b6966] font-medium">Structure</div>
                          <div className="text-xs font-semibold text-[#161616]">
                            {test.mcqCount} MCQ • {test.codingCount} Code
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Candidate Current Progress State */}
                    <div className="mb-6">
                      {isCompleted ? (
                        <div className="p-3.5 rounded-xl bg-[#eef7ee] border border-[#15803d]/20 text-[#15803d] flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-bold">Assessment Completed</div>
                              <div className="text-[11px] text-[#15803d]/80">
                                Answered {test.answersCount} of {test.totalQuestions} questions
                              </div>
                            </div>
                          </div>
                          {test.score > 0 && (
                            <div className="text-sm font-bold bg-white/70 px-2.5 py-1 rounded-md">
                              Score: {test.score}
                            </div>
                          )}
                        </div>
                      ) : hasStarted ? (
                        <div className="p-3.5 rounded-xl bg-[#fff8e6] border border-[#d97706]/20 text-[#b45309] flex items-center gap-2.5">
                          <Clock className="w-5 h-5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-bold">In Progress</div>
                            <div className="text-[11px] text-[#b45309]/80">
                              Resuming at {test.answersCount} of {test.totalQuestions} answered
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-[#ece7df] text-[#6b6966] text-xs flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#15803d]" />
                          <span>Not started yet. Ready to take exam in full screen chamber.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-[#e6e1d8] flex flex-wrap items-center gap-3 justify-between">
                    {isCompleted ? (
                      <div className="flex items-center gap-2 w-full justify-between">
                        <button
                          onClick={() => handleResetTest(test._id, test.title)}
                          disabled={resettingId === test._id}
                          className="serene-btn-secondary px-4 py-2.5 text-xs font-semibold tracking-wide flex items-center gap-1.5 hover:text-red-700"
                          title="Clear existing responses and retake test"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${resettingId === test._id ? "animate-spin" : ""}`} />
                          {resettingId === test._id ? "Resetting..." : "Retake Assessment"}
                        </button>

                        <button
                          onClick={() => router.push(`/test/${test._id}`)}
                          className="serene-btn-primary px-5 py-2.5 text-xs font-semibold tracking-wide flex items-center gap-2"
                        >
                          View Submission
                          <ArrowRight className="w-3.5 h-3.5 text-[#fbf9f6]" />
                        </button>
                      </div>
                    ) : hasStarted ? (
                      <div className="flex items-center gap-2 w-full justify-between">
                        <button
                          onClick={() => handleResetTest(test._id, test.title)}
                          disabled={resettingId === test._id}
                          className="serene-btn-secondary px-3.5 py-2.5 text-xs font-semibold text-[#6b6966] hover:text-red-700 flex items-center gap-1.5"
                          title="Restart from Question 1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Start Fresh
                        </button>

                        <button
                          onClick={() => router.push(`/test/${test._id}`)}
                          className="serene-btn-primary px-6 py-2.5 text-xs font-semibold tracking-wide flex items-center gap-2"
                        >
                          Resume Assessment
                          <ArrowRight className="w-3.5 h-3.5 text-[#fbf9f6]" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => router.push(`/test/${test._id}`)}
                        className="serene-btn-primary w-full py-3 text-xs font-semibold tracking-wide flex items-center justify-center gap-2"
                      >
                        Enter Examination Chamber
                        <ArrowRight className="w-3.5 h-3.5 text-[#fbf9f6]" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full mt-16 pt-6 border-t border-[#e6e1d8] text-center text-xs text-[#6b6966]">
        NextGen Examination Chamber • Synchronously Monitored by Supervisor Matrix • ID: ROOM-CS-2026
      </footer>
    </div>
  );
}
