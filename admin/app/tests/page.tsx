"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import {
  Plus,
  Save,
  Trash2,
  Code2,
  ListChecks,
  Eye,
  EyeOff,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  HelpCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ITest, IQuestion, QuestionType, OptionKey, ITestCase } from "@nextgen/shared-types";

interface QuestionFormData {
  _id?: string;
  order: number;
  type: QuestionType;
  text: string;
  options: { key: "a" | "b" | "c" | "d"; text: string }[];
  correctOption?: "a" | "b" | "c" | "d";
  language?: string;
  starterCode?: string;
  timeLimitMs?: number;
  memoryLimitKb?: number;
  testCases: { input: string; expectedOutput: string; isHidden: boolean }[];
}

export default function TestsPage() {
  return (
    <AuthGuard>
      <AdminLayout>
        <TestsContent />
      </AdminLayout>
    </AuthGuard>
  );
}

function TestsContent() {
  const [tests, setTests] = useState<ITest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [managingTest, setManagingTest] = useState<ITest | null>(null);

  useEffect(() => {
    fetchTests();
  }, []);

  async function fetchTests() {
    setLoading(true);
    try {
      const res = await api.get("/admin/tests");
      setTests(res.data.tests || res.data || []);
    } catch (e) {
      console.error("Failed to fetch tests:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTest(testId: string, title: string) {
    if (!confirm(`Are you sure you want to permanently delete "${title}" and all associated questions and records?`)) {
      return;
    }
    try {
      await api.delete(`/admin/tests/${testId}`);
      await fetchTests();
    } catch (e: any) {
      console.error("Failed to delete test:", e);
      alert(e?.response?.data?.error || "Failed to delete assessment");
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {managingTest ? (
        <QuestionsManager
          test={managingTest}
          onBack={() => {
            setManagingTest(null);
            fetchTests();
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-editorial text-2xl font-bold text-black tracking-tight">
                Assessment Management
              </h2>
              <p className="text-xs text-[#6b6966] mt-1">
                Configure test schedules, question pools, and compiler test cases.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="serene-btn-primary px-4 py-2.5 text-xs font-semibold gap-2"
            >
              <Plus className="h-4 w-4 text-emerald-400" />
              Create Assessment
            </button>
          </div>

          {showCreate && (
            <TestForm
              onClose={() => setShowCreate(false)}
              onSaved={() => {
                setShowCreate(false);
                fetchTests();
              }}
            />
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-[#6b6966]">Loading assessments...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {tests.map((test) => (
                <div
                  key={test._id}
                  className="serene-card p-6 border border-[#e6e1d8] space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-editorial text-lg font-bold text-black">
                        {test.title}
                      </h3>
                      <p className="text-xs text-[#6b6966] mt-1">
                        Room ID: <span className="font-mono font-bold text-black">{test.roomId}</span>
                      </p>
                    </div>
                    <span
                      className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        test.status === "live"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : test.status === "ended"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-blue-100 text-blue-800 border border-blue-300"
                      }`}
                    >
                      {test.status}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-[#e6e1d8] text-xs text-[#6b6966]">
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#15803d]" />
                        <span>
                          {new Date(test.scheduledStartTime).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div>Duration: <strong className="text-black">{test.durationMinutes} mins</strong></div>
                      <div>Questions: <strong className="text-black">{test.questions?.length || 0}</strong></div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setManagingTest(test)}
                        className="serene-btn-primary px-4 py-2 text-xs font-semibold gap-1.5"
                      >
                        <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
                        Configure Questions ({test.questions?.length || 0})
                      </button>
                      <button
                        onClick={() => handleDeleteTest(test._id, test.title)}
                        className="serene-circle w-8 h-8 text-[#6b6966] hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete Assessment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Dedicated Question Manager for an Existing Test
// ----------------------------------------------------------------------------
function QuestionsManager({ test, onBack }: { test: ITest; onBack: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<QuestionFormData | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [test._id]);

  async function fetchQuestions() {
    setLoading(true);
    try {
      const res = await api.get(`/admin/tests/${test._id}/questions`);
      setQuestions(res.data.questions || []);
    } catch (e) {
      console.error("Failed to load questions:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleAddNew() {
    setEditingQuestion({
      order: questions.length + 1,
      type: "mcq",
      text: "",
      options: [
        { key: "a", text: "" },
        { key: "b", text: "" },
        { key: "c", text: "" },
        { key: "d", text: "" },
      ],
      correctOption: "a",
      language: "javascript",
      starterCode: `// Read from standard input\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\n\n// Write solution here\n`,
      timeLimitMs: 2000,
      memoryLimitKb: 262144,
      testCases: [{ input: "", expectedOutput: "", isHidden: false }],
    });
    setIsAddingNew(true);
  }

  function handleEdit(q: any) {
    setEditingQuestion({
      _id: q._id,
      order: q.order || 1,
      type: q.type || "mcq",
      text: q.text || "",
      options: q.options || [
        { key: "a", text: "" },
        { key: "b", text: "" },
        { key: "c", text: "" },
        { key: "d", text: "" },
      ],
      correctOption: q.correctOption || "a",
      language: q.language || "javascript",
      starterCode: q.starterCode || "",
      timeLimitMs: q.timeLimitMs || 2000,
      memoryLimitKb: q.memoryLimitKb || 262144,
      testCases: q.testCases || [],
    });
    setIsAddingNew(false);
  }

  async function handleDelete(qId: string) {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await api.delete(`/admin/tests/${test._id}/questions/${qId}`);
      await fetchQuestions();
    } catch (e) {
      console.error("Failed to delete question:", e);
    }
  }

  async function handleSaveQuestion(qData: QuestionFormData) {
    try {
      if (isAddingNew || !qData._id) {
        await api.post(`/admin/tests/${test._id}/questions`, qData);
      } else {
        await api.put(`/admin/tests/${test._id}/questions/${qData._id}`, qData);
      }
      setEditingQuestion(null);
      setIsAddingNew(false);
      await fetchQuestions();
    } catch (e) {
      console.error("Failed to save question:", e);
      alert("Failed to save question. Please verify all required fields.");
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#e6e1d8]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="serene-btn-secondary px-3.5 py-2 text-xs font-semibold gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Assessments
          </button>
          <div>
            <h2 className="font-editorial text-xl font-bold text-black tracking-tight">
              {test.title}
            </h2>
            <p className="text-xs text-[#6b6966]">
              Configuring question pool · Room: <span className="font-mono font-bold text-black">{test.roomId}</span>
            </p>
          </div>
        </div>

        {!editingQuestion && (
          <button
            onClick={handleAddNew}
            className="serene-btn-primary px-4 py-2 text-xs font-semibold gap-2"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> Add Question
          </button>
        )}
      </div>

      {/* Editor Modal / Drawer */}
      {editingQuestion ? (
        <QuestionEditorCard
          initialData={editingQuestion}
          isNew={isAddingNew}
          onSave={handleSaveQuestion}
          onCancel={() => {
            setEditingQuestion(null);
            setIsAddingNew(false);
          }}
        />
      ) : (
        /* Question List */
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#6b6966]">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="serene-card p-12 text-center border border-[#e6e1d8]">
              <HelpCircle className="w-9 h-9 text-[#6b6966] mx-auto mb-2 opacity-60" />
              <p className="font-editorial text-base font-bold text-black">No questions configured yet</p>
              <p className="text-xs text-[#6b6966] mb-5 mt-1">
                Add multiple-choice or compiler-backed coding problems to this assessment.
              </p>
              <button onClick={handleAddNew} className="serene-btn-primary px-4 py-2.5 text-xs font-semibold gap-2">
                <Plus className="w-4 h-4 text-emerald-400" /> Add First Question
              </button>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q._id || idx} className="serene-card p-5 border border-[#e6e1d8] flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#ece7df] text-black border border-[#dbdad7]">
                      #{q.order || idx + 1}
                    </span>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                        q.type === "coding"
                          ? "bg-purple-100 text-purple-900 border border-purple-200"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                      }`}
                    >
                      {q.type === "coding" ? (
                        <Code2 className="w-3 h-3 text-purple-700" />
                      ) : (
                        <ListChecks className="w-3 h-3 text-emerald-700" />
                      )}
                      {q.type === "coding" ? `Coding (${q.language || "javascript"})` : "MCQ"}
                    </span>
                  </div>

                  <p className="font-semibold text-black text-sm leading-relaxed">{q.text}</p>

                  {q.type === "mcq" && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      {q.options.map((opt: any) => (
                        <div
                          key={opt.key}
                          className={`p-2 rounded-xl border text-xs transition ${
                            opt.key === q.correctOption
                              ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                              : "bg-[#ece7df]/40 border-[#e6e1d8] text-[#161616]"
                          }`}
                        >
                          <span className="uppercase font-bold mr-1.5 text-[#15803d]">{opt.key})</span>
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === "coding" && (
                    <div className="flex items-center gap-4 text-xs text-[#6b6966] pt-1">
                      <span>
                        <strong className="text-black">Test Cases:</strong> {q.testCases?.length || 0} (
                        {q.testCases?.filter((t: any) => !t.isHidden).length || 0} sample,{" "}
                        {q.testCases?.filter((t: any) => t.isHidden).length || 0} hidden)
                      </span>
                      <span>
                        <strong className="text-black">Time Limit:</strong> {q.timeLimitMs || 2000}ms
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(q)}
                    className="serene-btn-secondary px-3 py-1.5 text-xs font-semibold gap-1"
                  >
                    <Edit3 className="w-3 h-3 text-black" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(q._id)}
                    className="serene-circle w-8 h-8 text-[#6b6966] hover:text-red-600 hover:bg-red-50 transition"
                    title="Delete Question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Rich Question Editor Component (MCQ + Compiler Coding Question)
// ----------------------------------------------------------------------------
function QuestionEditorCard({
  initialData,
  isNew,
  onSave,
  onCancel,
}: {
  initialData: QuestionFormData;
  isNew: boolean;
  onSave: (data: QuestionFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<QuestionFormData>(initialData);

  function updateField<K extends keyof QuestionFormData>(field: K, val: QuestionFormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: val }));
  }

  function addTestCase() {
    updateField("testCases", [
      ...formData.testCases,
      { input: "", expectedOutput: "", isHidden: false },
    ]);
  }

  function updateTestCase(idx: number, field: string, val: any) {
    const next = [...formData.testCases];
    next[idx] = { ...next[idx], [field]: val };
    updateField("testCases", next);
  }

  function removeTestCase(idx: number) {
    updateField(
      "testCases",
      formData.testCases.filter((_, i) => i !== idx)
    );
  }

  return (
    <div className="serene-card p-6 border border-[#e6e1d8] space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[#e6e1d8]">
        <div>
          <h3 className="font-editorial text-lg font-bold text-black">
            {isNew ? "Add New Assessment Question" : `Edit Question #${formData.order}`}
          </h3>
          <p className="text-xs text-[#6b6966] mt-0.5">
            Configure prompt statement, options, or compiler execution test cases.
          </p>
        </div>
      </div>

      {/* Question Type & Order */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">Question Type</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateField("type", "mcq")}
              className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                formData.type === "mcq"
                  ? "bg-[#161616] text-[#fbf9f6] border-[#161616] shadow-sm"
                  : "bg-[#f5f2eb] border-[#e6e1d8] text-[#161616] hover:bg-[#ece7df]"
              }`}
            >
              <ListChecks className="w-4 h-4 text-emerald-400" /> Multiple Choice (MCQ)
            </button>
            <button
              type="button"
              onClick={() => updateField("type", "coding")}
              className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                formData.type === "coding"
                  ? "bg-[#161616] text-[#fbf9f6] border-[#161616] shadow-sm"
                  : "bg-[#f5f2eb] border-[#e6e1d8] text-[#161616] hover:bg-[#ece7df]"
              }`}
            >
              <Code2 className="w-4 h-4 text-purple-400" /> Coding Problem (Compiler)
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">Sequence Order</label>
          <input
            type="number"
            min={1}
            value={formData.order}
            onChange={(e) => updateField("order", parseInt(e.target.value, 10) || 1)}
            className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {/* Question Text / Prompt */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
          Question Prompt / Problem Description
        </label>
        <textarea
          rows={4}
          value={formData.text}
          onChange={(e) => updateField("text", e.target.value)}
          placeholder={
            formData.type === "coding"
              ? "Describe the algorithmic problem, input specification, constraints, and sample expected output..."
              : "Enter the MCQ question statement..."
          }
          className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] p-3 text-xs leading-relaxed text-black focus:outline-none focus:ring-1 focus:ring-black"
        />
      </div>

      {/* MCQ OPTIONS SECTION */}
      {formData.type === "mcq" && (
        <div className="space-y-4 pt-4 border-t border-[#e6e1d8]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
              Answer Options & Correct Key
            </label>
            <span className="text-xs text-[#6b6966]">
              Select the radio corresponding to the correct answer.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {formData.options.map((opt) => (
              <div
                key={opt.key}
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  formData.correctOption === opt.key
                    ? "bg-emerald-50/90 border-emerald-400"
                    : "border-[#e6e1d8] bg-[#fbf9f6]"
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="correctOptionRadio"
                    checked={formData.correctOption === opt.key}
                    onChange={() => updateField("correctOption", opt.key)}
                    className="w-4 h-4 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="font-bold uppercase text-xs w-5 text-black">{opt.key})</span>
                </label>
                <input
                  value={opt.text}
                  onChange={(e) => {
                    const next = formData.options.map((o) =>
                      o.key === opt.key ? { ...o, text: e.target.value } : o
                    );
                    updateField("options", next);
                  }}
                  placeholder={`Option ${opt.key.toUpperCase()} text...`}
                  className="flex-1 text-xs bg-transparent border-b border-transparent focus:border-black focus:outline-none py-1 text-black font-medium"
                />
                {formData.correctOption === opt.key && (
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CODING PROBLEM CONFIGURATION */}
      {formData.type === "coding" && (
        <div className="space-y-6 pt-4 border-t border-[#e6e1d8]">
          {/* Language & Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
                Execution Language
              </label>
              <select
                value={formData.language || "javascript"}
                onChange={(e) => updateField("language", e.target.value)}
                className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="javascript">JavaScript (Node.js)</option>
                <option value="python">Python (Python 3)</option>
                <option value="cpp">C++ (G++ 13)</option>
                <option value="java">Java (JDK 21)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
                Time Limit (ms)
              </label>
              <input
                type="number"
                min={500}
                step={500}
                value={formData.timeLimitMs || 2000}
                onChange={(e) => updateField("timeLimitMs", parseInt(e.target.value, 10) || 2000)}
                className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
                Memory Limit (KB)
              </label>
              <input
                type="number"
                min={65536}
                step={65536}
                value={formData.memoryLimitKb || 262144}
                onChange={(e) =>
                  updateField("memoryLimitKb", parseInt(e.target.value, 10) || 262144)
                }
                className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          {/* Starter Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
              Starter Code Template
            </label>
            <textarea
              rows={6}
              value={formData.starterCode || ""}
              onChange={(e) => updateField("starterCode", e.target.value)}
              placeholder="// Code template provided to the candidate..."
              className="w-full rounded-xl border border-[#262626] bg-[#161616] p-3 text-xs font-mono text-[#fbf9f6] focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          {/* Test Cases Configurator */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
                  Compiler Test Cases ({formData.testCases.length})
                </label>
                <p className="text-xs text-[#6b6966]">
                  Sample cases are visible to candidates. Hidden cases are used for final score grading.
                </p>
              </div>
              <button
                type="button"
                onClick={addTestCase}
                className="serene-btn-secondary px-3 py-1.5 text-xs font-semibold gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#15803d]" /> Add Test Case
              </button>
            </div>

            <div className="space-y-3">
              {formData.testCases.map((tc, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border space-y-3 ${
                    tc.isHidden ? "bg-[#ece7df]/40 border-[#dbdad7]" : "bg-[#fbf9f6] border-[#e6e1d8]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-black">
                      Test Case #{idx + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={tc.isHidden}
                          onChange={(e) => updateTestCase(idx, "isHidden", e.target.checked)}
                          className="rounded border-[#e6e1d8] text-black focus:ring-black"
                        />
                        {tc.isHidden ? (
                          <span className="text-amber-800 font-bold flex items-center gap-1 text-[11px]">
                            <EyeOff className="w-3.5 h-3.5" /> Hidden Test Case
                          </span>
                        ) : (
                          <span className="text-emerald-800 font-bold flex items-center gap-1 text-[11px]">
                            <Eye className="w-3.5 h-3.5" /> Sample Visible Case
                          </span>
                        )}
                      </label>

                      <button
                        type="button"
                        onClick={() => removeTestCase(idx)}
                        className="text-[#6b6966] hover:text-red-600 p-1"
                        title="Remove Case"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-[#6b6966] uppercase tracking-wider block mb-1">
                        Standard Input (stdin)
                      </label>
                      <textarea
                        rows={2}
                        value={tc.input}
                        onChange={(e) => updateTestCase(idx, "input", e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full rounded-lg border border-[#e6e1d8] bg-[#f5f2eb] p-2 font-mono text-xs text-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#6b6966] uppercase tracking-wider block mb-1">
                        Expected Output (stdout)
                      </label>
                      <textarea
                        rows={2}
                        value={tc.expectedOutput}
                        onChange={(e) => updateTestCase(idx, "expectedOutput", e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full rounded-lg border border-[#e6e1d8] bg-[#f5f2eb] p-2 font-mono text-xs text-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e6e1d8]">
        <button
          onClick={onCancel}
          className="serene-btn-secondary px-4 py-2 text-xs font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(formData)}
          className="serene-btn-primary px-5 py-2 text-xs font-semibold gap-2"
        >
          <Save className="w-4 h-4 text-emerald-400" /> Save Question
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Create Test Form
// ----------------------------------------------------------------------------
function TestForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!title || !scheduledStartTime || !durationMinutes) {
      alert("Please fill in all required assessment fields.");
      return;
    }

    setLoading(true);
    const finalRoom = (roomId.trim() || `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`).toUpperCase();
    const payload = {
      title,
      roomId: finalRoom,
      scheduledStartTime: new Date(scheduledStartTime).toISOString(),
      durationMinutes: parseInt(durationMinutes, 10),
      defaultPassword: defaultPassword || undefined,
      questions: [],
    };

    try {
      await api.post("/admin/tests", payload);
      onSaved();
    } catch (e: any) {
      console.error("Failed to create test:", e);
      alert(e?.response?.data?.error || "Failed to create test.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="serene-card p-6 border border-[#e6e1d8] space-y-4">
      <div className="pb-3 border-b border-[#e6e1d8]">
        <h3 className="font-editorial text-lg font-bold text-black">Create New Assessment</h3>
        <p className="text-xs text-[#6b6966] mt-0.5">
          Schedule exam timing, room configuration, and candidate access keys.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
              Assessment Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Systems & Data Structures Midterm"
              className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
              Room ID (optional, auto-generated if empty)
            </label>
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="e.g. ROOM-DSA-2026"
              className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
              Scheduled Start Time *
            </label>
            <input
              type="datetime-local"
              value={scheduledStartTime}
              onChange={(e) => setScheduledStartTime(e.target.value)}
              className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
              Duration (minutes) *
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#161616] uppercase tracking-wider">
            Default Candidate Password (optional)
          </label>
          <input
            type="password"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            placeholder="Initial password for enrolled candidates"
            className="w-full rounded-xl border border-[#e6e1d8] bg-[#fbf9f6] px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="serene-btn-primary px-5 py-2 text-xs font-semibold gap-2"
          >
            <Save className="h-4 w-4 text-emerald-400" />
            {loading ? "Creating..." : "Save Assessment"}
          </button>
          <button
            onClick={onClose}
            className="serene-btn-secondary px-4 py-2 text-xs font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
