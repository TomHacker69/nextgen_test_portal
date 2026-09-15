"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import {
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Send,
  Loader2,
  Wifi,
  WifiOff,
  LogOut,
  Award,
} from "lucide-react";
import { IQuestion, OptionKey } from "@/types";

interface ITestMeta {
  _id: string;
  title: string;
  roomId: string;
  status: "scheduled" | "live" | "ended";
  durationMinutes: number;
}

export default function TestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const router = useRouter();
  const { testId } = use(params);

  const [test, setTest] = useState<ITestMeta | null>(null);
  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, OptionKey>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);

  // Fetch test details, questions (correctOption stripped), and existing responses
  useEffect(() => {
    let isMounted = true;

    async function loadTest() {
      try {
        const res = await fetch(`/api/test/${testId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load test session");
        }

        if (isMounted) {
          setTest(data.test);
          setQuestions(data.questions || []);
          setUserAnswers(data.responses || {});
          setIsCompleted(Boolean(data.isCompleted));

          // Resume recovery: Find the first unanswered question
          if (data.questions && data.questions.length > 0 && !data.isCompleted) {
            const answeredMap = data.responses || {};
            const firstUnanswered = data.questions.findIndex(
              (q: IQuestion) => !answeredMap[q._id]
            );

            if (firstUnanswered !== -1) {
              setCurrentIndex(firstUnanswered);
              setSelectedOption(answeredMap[data.questions[firstUnanswered]._id] || null);
            } else {
              // All answered, stay at last or complete
              setCurrentIndex(data.questions.length - 1);
              setSelectedOption(answeredMap[data.questions[data.questions.length - 1]._id] || null);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load test");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTest();

    return () => {
      isMounted = false;
    };
  }, [testId, router]);

  // Connect to Socket.IO & listen for test:started
  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setSocketConnected(true);
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onTestStarted(payload: { testId: string; roomId: string }) {
      if (payload.testId === testId) {
        setTest((prev) => (prev ? { ...prev, status: "live" } : null));
      }
    }

    if (socket.connected) {
      onConnect();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("test:started", onTestStarted);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("test:started", onTestStarted);
    };
  }, [testId]);

  // Sync selectedOption when currentIndex changes
  useEffect(() => {
    if (questions[currentIndex]) {
      const qId = questions[currentIndex]._id;
      setSelectedOption(userAnswers[qId] || null);
    }
  }, [currentIndex, questions, userAnswers]);

  // Keyboard shortcut listener: 1/A -> a, 2/B -> b, etc.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isCompleted || test?.status !== "live") return;
      const key = e.key.toLowerCase();
      if (["a", "b", "c", "d"].includes(key)) {
        setSelectedOption(key as OptionKey);
      } else if (key === "1") setSelectedOption("a");
      else if (key === "2") setSelectedOption("b");
      else if (key === "3") setSelectedOption("c");
      else if (key === "4") setSelectedOption("d");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCompleted, test?.status]);

  // Handle discrete answer submission & advance
  const handleAnswerSubmit = async () => {
    if (!selectedOption || !questions[currentIndex] || !test) return;

    setSubmitting(true);
    setError(null);

    const currentQ = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;

    try {
      const socket = getSocket();

      // Emit answer:submit via socket
      await new Promise<void>((resolve, reject) => {
        socket.emit(
          "answer:submit",
          {
            testId: test._id,
            questionId: currentQ._id,
            selectedOption,
            questionIndex: currentIndex,
          },
          (response: { success: boolean; error?: string }) => {
            if (response && response.success) {
              resolve();
            } else {
              reject(new Error(response?.error || "Submission failed"));
            }
          }
        );
      });

      // Update local state
      setUserAnswers((prev) => ({
        ...prev,
        [currentQ._id]: selectedOption,
      }));

      // If last question, emit user:completed
      if (isLastQuestion) {
        socket.emit("user:completed", { testId: test._id });
        setIsCompleted(true);
      } else {
        // Advance to next question
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
        <p className="text-sm">Connecting to secure assessment environment...</p>
      </div>
    );
  }

  if (error && !test) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-6">
        <div className="glass-panel max-w-md p-8 rounded-2xl text-center border border-rose-500/20">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-cyan-500 text-slate-950 rounded-xl font-semibold text-xs"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // 1. Waiting Screen Flow
  if (test?.status === "scheduled") {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#090d16] to-[#090d16] flex flex-col justify-between">
        {/* Top Header */}
        <header className="border-b border-slate-800 px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-white text-sm">Assessment Lobby</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400 live-pulse" />
              Room: {test.roomId}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-white p-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Center Card */}
        <main className="max-w-lg mx-auto px-6 text-center">
          <div className="relative inline-flex mb-8">
            <div className="w-24 h-24 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" />
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
            {test.title}
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            The assessment session has not commenced yet. Please remain on this screen. When the
            admin starts the test, your question screen will unlock automatically in real time.
          </p>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-3">
            {socketConnected ? (
              <span className="flex items-center gap-2 text-emerald-400 font-medium">
                <Wifi className="w-4 h-4" />
                Live Channel Synchronized (Socket.IO Connected)
              </span>
            ) : (
              <span className="flex items-center gap-2 text-amber-400 font-medium">
                <WifiOff className="w-4 h-4" />
                Connecting to socket channel...
              </span>
            )}
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-slate-600">
          Scheduled Duration: {test.durationMinutes} minutes • Total Questions: {questions.length}
        </footer>
      </div>
    );
  }

  // 2. Completed Screen Flow
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#090d16] to-[#090d16] flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel max-w-lg p-10 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-6">
            <Award className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Test Submitted Successfully!</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            All your responses have been atomically saved to the database and synced to the supervisor
            live dashboard.
          </p>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-left mb-8 space-y-2 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Assessment:</span>
              <span className="text-white font-medium">{test?.title}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Questions Answered:</span>
              <span className="text-emerald-400 font-bold">
                {Object.keys(userAnswers).length} / {questions.length}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Submission Mode:</span>
              <span className="text-cyan-400">Real-Time Persistent Socket</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
          >
            Exit Portal & Sign Out
          </button>
        </div>
      </div>
    );
  }

  // 3. Active MCQ Flow
  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length
    ? Math.round(((currentIndex + 1) / questions.length) * 100)
    : 0;
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-white text-sm tracking-tight truncate max-w-xs sm:max-w-md">
              {test?.title}
            </h1>
            <span className="text-[11px] text-slate-400">
              Room {test?.roomId} • {test?.durationMinutes} mins
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span>In Progress</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-white p-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-800 h-1">
          <div
            className="bg-gradient-to-r from-cyan-400 to-sky-500 h-1 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main MCQ Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 flex flex-col justify-between">
        <div>
          {/* Question Sequence Badge */}
          <div className="flex items-center justify-between mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono">
              Question {currentIndex + 1} of {questions.length}
            </span>

            <span className="text-xs text-slate-500 font-mono">
              {Object.keys(userAnswers).length} answered
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Question Card */}
          {currentQuestion && (
            <div className="glass-panel p-8 rounded-3xl border border-slate-800 mb-8 shadow-xl">
              <h2 className="text-lg sm:text-xl font-semibold text-white leading-relaxed mb-8">
                {currentQuestion.text}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((opt) => {
                  const isSelected = selectedOption === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSelectedOption(opt.key)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                        isSelected
                          ? "bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10"
                          : "bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl font-bold font-mono text-xs flex items-center justify-center flex-shrink-0 uppercase transition ${
                          isSelected
                            ? "bg-cyan-500 text-slate-950 font-extrabold"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm font-medium leading-normal">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation & Submit */}
        <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(userAnswers[q._id]);
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={q._id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-semibold transition ${
                    isCurrent
                      ? "ring-2 ring-cyan-400 bg-cyan-500 text-slate-950 font-bold"
                      : isAnswered
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-900 border border-slate-800 text-slate-500 hover:text-white"
                  }`}
                  title={`Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleAnswerSubmit}
            disabled={!selectedOption || submitting}
            className={`py-3 px-6 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${
              isLast
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20"
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing Answer...
              </>
            ) : isLast ? (
              <>
                Submit Final Test
                <Send className="w-4 h-4" />
              </>
            ) : (
              <>
                Save & Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
