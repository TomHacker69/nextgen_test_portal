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
  ArrowLeft,
  Send,
  Loader2,
  Wifi,
  WifiOff,
  LogOut,
  Award,
  Zap,
  ChevronRight,
  Code2,
  Play,
  RotateCcw,
  Terminal,
  FileCode,
  Check,
  X,
  Eye,
} from "lucide-react";
import { IQuestion, OptionKey, ITestCase } from "@/types";
import CodingStudio from "./components/CodingStudio";

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
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);

  // Coding question specific state
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({});
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, string>>({});
  const [runningCode, setRunningCode] = useState(false);
  const [runResults, setRunResults] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<"editor" | "results">("editor");

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

        const text = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text || `Server responded with status ${res.status}`);
        }

        if (!res.ok) {
          throw new Error(data.error || "Failed to load test session");
        }

        if (isMounted) {
          setTest(data.test);
          const loadedQuestions = data.questions || [];
          setQuestions(loadedQuestions);
          setUserAnswers(data.responses || {});
          setIsCompleted(Boolean(data.isCompleted));

          // Pre-populate code answers with starterCode or persisted responses
          const initialCodeMap: Record<string, string> = {};
          const initialLangMap: Record<string, string> = {};
          loadedQuestions.forEach((q: IQuestion) => {
            if (q.type === "coding") {
              initialCodeMap[q._id] = data.responses?.[q._id] || q.starterCode || "";
              initialLangMap[q._id] = q.language || "javascript";
            }
          });
          setCodeAnswers(initialCodeMap);
          setSelectedLanguages(initialLangMap);

          // Resume recovery: Find the first unanswered question
          if (loadedQuestions.length > 0 && !data.isCompleted) {
            const answeredMap = data.responses || {};
            const firstUnanswered = loadedQuestions.findIndex(
              (q: IQuestion) => !answeredMap[q._id]
            );

            if (firstUnanswered !== -1) {
              setCurrentIndex(firstUnanswered);
              if (loadedQuestions[firstUnanswered].type === "mcq") {
                setSelectedOption(answeredMap[loadedQuestions[firstUnanswered]._id] || null);
              }
            } else {
              setCurrentIndex(loadedQuestions.length - 1);
              if (loadedQuestions[loadedQuestions.length - 1].type === "mcq") {
                setSelectedOption(
                  answeredMap[loadedQuestions[loadedQuestions.length - 1]._id] || null
                );
              }
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
      const q = questions[currentIndex];
      if (q.type === "mcq") {
        setSelectedOption((userAnswers[q._id] as OptionKey) || null);
      }
    }

    // Real-time telemetry: notify supervisor console of candidate question navigation
    if (test?._id && !isCompleted) {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("user:navigate", {
          testId: test._id,
          questionIndex: currentIndex,
        });
      }
    }
  }, [currentIndex, questions, userAnswers, test?._id, isCompleted]);

  // Keyboard shortcut listener for MCQ (ignore if typing in code or input)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isCompleted || test?.status !== "live") return;
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const curQ = questions[currentIndex];
      if (!curQ || curQ.type !== "mcq") return;

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
  }, [isCompleted, test?.status, currentIndex, questions]);

  // Handle MCQ Answer Submission
  const handleMcqSubmit = async () => {
    if (!selectedOption || !questions[currentIndex] || !test) return;

    setSubmitting(true);
    setError(null);

    const currentQ = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;

    try {
      const socket = getSocket();

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

      setUserAnswers((prev) => ({
        ...prev,
        [currentQ._id]: selectedOption,
      }));

      if (isLastQuestion) {
        socket.emit("user:completed", { testId: test._id });
        setIsCompleted(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  // Run Code against visible/sample test cases or custom input
  const handleRunCode = async (customInput?: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ || currentQ.type !== "coding" || !test) return;

    const currentCode = codeAnswers[currentQ._id] ?? currentQ.starterCode ?? "";
    const currentLang = selectedLanguages[currentQ._id] || currentQ.language || "javascript";

    setRunningCode(true);
    setActiveTab("results");
    setError(null);

    try {
      const res = await fetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: test._id,
          questionId: currentQ._id,
          code: currentCode,
          language: currentLang,
          customInput: customInput || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Execution failed");
      }

      setRunResults((prev) => ({
        ...prev,
        [currentQ._id]: data.summary,
      }));
    } catch (err: any) {
      setError(err.message || "Code execution failed");
    } finally {
      setRunningCode(false);
    }
  };

  // Submit Final Code for Grading
  const handleCodeSubmit = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || currentQ.type !== "coding" || !test) return;

    const currentCode = codeAnswers[currentQ._id] ?? currentQ.starterCode ?? "";
    const currentLang = selectedLanguages[currentQ._id] || currentQ.language || "javascript";
    const isLastQuestion = currentIndex === questions.length - 1;

    setSubmitting(true);
    setActiveTab("results");
    setError(null);

    try {
      const res = await fetch("/api/code/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: test._id,
          questionId: currentQ._id,
          code: currentCode,
          language: currentLang,
          questionIndex: currentIndex,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setRunResults((prev) => ({
        ...prev,
        [currentQ._id]: data.summary,
      }));

      setUserAnswers((prev) => ({
        ...prev,
        [currentQ._id]: "submitted",
      }));

      if (isLastQuestion) {
        const socket = getSocket();
        socket.emit("user:completed", { testId: test._id });
        setIsCompleted(true);
      }
    } catch (err: any) {
      setError(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
  };

  const handleResetSelf = async () => {
    if (!test?._id) return;
    if (
      !window.confirm(
        "Are you sure you want to reset your answers and start this assessment fresh?"
      )
    )
      return;

    try {
      setLoading(true);
      const res = await fetch(`/api/test/${test._id}/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      setUserAnswers({});
      setIsCompleted(false);
      setCurrentIndex(0);
      setSelectedOption(null);
    } catch (err: any) {
      alert(err.message || "Failed to reset");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex flex-col items-center justify-center text-[#6b6966]">
        <Loader2 className="w-7 h-7 animate-spin text-[#15803d] mb-3" />
        <p className="text-sm font-normal">Loading assessment chamber...</p>
      </div>
    );
  }

  if (error && !test) {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex items-center justify-center p-6">
        <div className="serene-card max-w-md p-8 text-center">
          <AlertCircle className="w-10 h-10 text-[#ba1a1a] mx-auto mb-3" />
          <h2 className="font-editorial text-xl font-normal text-[#161616] mb-2">Access Notice</h2>
          <p className="text-sm text-[#6b6966] mb-6">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="serene-btn-primary px-5 py-2.5 text-xs font-semibold"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // WAITING ROOM SCREEN
  if (test?.status === "scheduled") {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex flex-col justify-between p-6">
        <div className="max-w-md mx-auto w-full pt-16 text-center">
          <div className="serene-card p-8">
            <div className="serene-circle w-14 h-14 mx-auto mb-6 text-[#15803d] bg-[#f5f2eb]">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>

            <h1 className="font-editorial text-2xl font-bold text-black mb-3">
              {test.title}
            </h1>

            <p className="text-sm text-[#6b6966] mb-6 font-normal leading-relaxed">
              The assessment session has not commenced yet. You may remain on this screen or click below to begin now.
            </p>

            <button
              onClick={() => setTest((prev) => (prev ? { ...prev, status: "live" } : null))}
              className="w-full mb-6 py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              Begin Assessment Now
            </button>

            <div className="serene-inset-pill p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#6b6966]">Room Code:</span>
                <span className="font-mono font-semibold text-[#161616]">{test.roomId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6b6966]">Duration:</span>
                <span className="font-semibold text-[#161616]">{test.durationMinutes} Minutes</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs text-[#6b6966] hover:text-[#161616] flex items-center justify-center gap-1.5 mx-auto"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TEST COMPLETED SCREEN
  if (isCompleted || test?.status === "ended") {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex items-center justify-center p-6">
        <div className="serene-card max-w-md w-full p-8 text-center">
          <div className="serene-circle w-14 h-14 mx-auto mb-6 text-[#15803d] bg-[#f5f2eb]">
            <Award className="w-7 h-7" />
          </div>

          <h1 className="font-editorial text-2xl font-bold text-black mb-2">
            Assessment Completed
          </h1>
          <p className="text-xs text-[#6b6966] mb-6">
            Your submissions and code evaluations have been recorded and sent to the proctoring console.
          </p>

          <div className="serene-inset-pill p-5 mb-8 text-left space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#6b6966]">Total Questions:</span>
              <span className="font-semibold text-[#161616]">{questions.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#6b6966]">Answered:</span>
              <span className="font-semibold text-[#15803d]">
                {Object.keys(userAnswers).length} / {questions.length}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="serene-btn-primary w-full py-3.5 font-semibold text-xs flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Assessments Dashboard
            </button>

            <button
              onClick={handleResetSelf}
              className="serene-btn-secondary w-full py-3 font-semibold text-xs flex items-center justify-center gap-2 hover:text-red-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retake Examination Fresh
            </button>

            <button
              onClick={handleLogout}
              className="text-xs text-[#6b6966] hover:text-[#161616] py-1 inline-block"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE ASSESSMENT SCREEN
  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progressPercent =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const isCodingQuestion = currentQuestion?.type === "coding";
  const questionCode = currentQuestion
    ? codeAnswers[currentQuestion._id] ?? currentQuestion.starterCode ?? ""
    : "";
  const currentLang = currentQuestion
    ? selectedLanguages[currentQuestion._id] || currentQuestion.language || "javascript"
    : "javascript";
  const currentResult = currentQuestion ? runResults[currentQuestion._id] : null;

  return (
    <div className="min-h-screen bg-[#fbf9f6] text-[#161616] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="border-b border-[#e6e1d8] bg-[#f5f2eb]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="serene-circle w-8 h-8 text-[#6b6966] hover:text-[#161616]"
              title="Return to Assessments Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-editorial font-bold text-base text-black truncate max-w-xs sm:max-w-md">
                {test?.title}
              </h1>
              <span className="text-[11px] text-[#6b6966]">
                Room {test?.roomId} • {test?.durationMinutes} mins
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#15803d] px-3 py-1 rounded-full serene-inset-pill">
              <Clock className="w-3.5 h-3.5" />
              <span>In Progress</span>
            </div>
            <button
              onClick={handleLogout}
              className="serene-circle w-8 h-8 text-[#6b6966] hover:text-[#161616]"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-[#e6e1d8] h-1">
          <div
            className="bg-[#15803d] h-1 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 w-full mx-auto px-4 sm:px-6 py-6 flex flex-col justify-between ${
          isCodingQuestion ? "max-w-[1560px]" : "max-w-3xl"
        }`}
      >
        <div>
          {/* Question Sequence Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold serene-inset-pill text-[#161616]">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span
                className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  isCodingQuestion
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}
              >
                {isCodingQuestion ? `Coding (${currentLang})` : "Multiple Choice"}
              </span>
            </div>

            <span className="text-xs text-[#6b6966] font-medium">
              {Object.keys(userAnswers).length} of {questions.length} completed
            </span>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MCQ QUESTION RENDERING */}
          {!isCodingQuestion && currentQuestion && (
            <div className="serene-card p-8 mb-6">
              <h2 className="font-editorial text-lg sm:text-xl font-normal text-[#161616] leading-relaxed mb-6">
                {currentQuestion.text}
              </h2>

              <div className="space-y-3">
                {currentQuestion?.options?.map((opt) => {
                  const isSelected = selectedOption === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSelectedOption(opt.key)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                        isSelected
                          ? "bg-[#15803d]/10 border-[#15803d] text-[#161616] shadow-sm"
                          : "bg-[#f5f2eb] border-[#e6e1d8] text-[#161616] hover:bg-[#ece7df]/70"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center flex-shrink-0 uppercase transition ${
                          isSelected
                            ? "bg-[#15803d] text-[#ffffff]"
                            : "bg-[#ece7df] text-[#6b6966]"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm font-normal leading-normal">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CODING QUESTION GLORIFIED STUDIO */}
          {isCodingQuestion && currentQuestion && (
            <CodingStudio
              question={currentQuestion}
              questionIndex={currentIndex}
              totalQuestions={questions.length}
              code={questionCode}
              language={currentLang}
              onCodeChange={(newCode) =>
                setCodeAnswers((prev) => ({
                  ...prev,
                  [currentQuestion._id]: newCode,
                }))
              }
              onLanguageChange={(newLang) =>
                setSelectedLanguages((prev) => ({
                  ...prev,
                  [currentQuestion._id]: newLang,
                }))
              }
              onResetCode={() =>
                setCodeAnswers((prev) => ({
                  ...prev,
                  [currentQuestion._id]: currentQuestion.starterCode || "",
                }))
              }
              onRunCode={handleRunCode}
              onSubmitCode={handleCodeSubmit}
              runningCode={runningCode}
              submitting={submitting}
              runResult={currentResult}
              userAnswered={Boolean(userAnswers[currentQuestion._id])}
            />
          )}
        </div>

        {/* Footer Navigation & Advance */}
        <div className="pt-6 border-t border-[#e6e1d8] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(userAnswers[q._id]);
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={q._id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                    isCurrent
                      ? "bg-[#161616] text-[#fbf9f6] ring-2 ring-[#161616]/30"
                      : isAnswered
                      ? "bg-[#15803d]/15 text-[#15803d] border border-[#15803d]/40"
                      : "bg-[#ece7df] text-[#6b6966] hover:text-[#161616]"
                  }`}
                  title={`Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {!isCodingQuestion ? (
              <button
                onClick={handleMcqSubmit}
                disabled={!selectedOption || submitting}
                className="serene-btn-primary py-3 px-6 font-semibold text-xs transition flex items-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#fbf9f6]" />
                    Saving...
                  </>
                ) : isLast ? (
                  <>
                    Submit Final Test
                    <Send className="w-4 h-4 text-[#fbf9f6]" />
                  </>
                ) : (
                  <>
                    Save & Next
                    <ArrowRight className="w-4 h-4 text-[#fbf9f6]" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!isLast) setCurrentIndex((prev) => prev + 1);
                }}
                disabled={isLast}
                className="serene-btn-primary py-3 px-6 font-semibold text-xs transition flex items-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next Question
                <ArrowRight className="w-4 h-4 text-[#fbf9f6]" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
