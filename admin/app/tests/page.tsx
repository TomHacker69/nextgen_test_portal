"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ITest, IQuestion, QuestionType, OptionKey } from "@nextgen/shared-types";

interface QuestionForm {
  order: number;
  type: QuestionType;
  text: string;
  options: { key: "a" | "b" | "c" | "d"; text: string }[];
  correctOption?: "a" | "b" | "c" | "d";
  language?: string;
  starterCode?: string;
  timeLimitMs?: number;
  memoryLimitKb?: number;
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
  const [editingTest, setEditingTest] = useState<ITest | null>(null);

  useEffect(() => {
    fetchTests();
  }, []);

  async function fetchTests() {
    setLoading(true);
    try {
      const res = await api.get("/admin/tests");
      setTests(res.data?.tests ?? res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tests</h2>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Test
        </Button>
      </div>

      {showCreate && (
        <TestForm
          onClose={() => setShowCreate(false)}
          onSaved={fetchTests}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <Card key={test._id}>
              <CardHeader>
                <CardTitle>{test.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Starts: {new Date(test.scheduledStartTime).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Duration: {test.durationMinutes} minutes
                    </p>
                    <p className="text-sm">
                      Status:{" "}
                      <span
                        className={
                          test.status === "live"
                            ? "text-green-600"
                            : test.status === "ended"
                            ? "text-gray-500"
                            : "text-blue-600"
                        }
                      >
                        {test.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingTest(test)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TestForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [roomId, setRoomId] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        order: questions.length,
        type: "mcq",
        text: "",
        options: [
          { key: "a", text: "" },
          { key: "b", text: "" },
          { key: "c", text: "" },
          { key: "d", text: "" },
        ],
      },
    ]);
  }

  async function handleSubmit() {
    const payload = {
      title,
      scheduledStartTime: new Date(scheduledStartTime).toISOString(),
      durationMinutes: parseInt(durationMinutes, 10),
      roomId,
      defaultPassword: defaultPassword || undefined,
      questions: questions.map((q) => ({
        order: q.order,
        type: q.type,
        text: q.text,
        options: q.options,
        correctOption: q.correctOption,
        language: q.language,
        starterCode: q.starterCode,
        timeLimitMs: q.timeLimitMs,
        memoryLimitKb: q.memoryLimitKb,
        testCases: [],
      })),
    };

    try {
      await api.post("/admin/tests", payload);
      onSaved();
      onClose();
    } catch (e) {
      console.error("Failed to create test:", e);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Test Title</Label>
          <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Scheduled Start Time</Label>
          <Input
            type="datetime-local"
            value={scheduledStartTime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledStartTime(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Duration (minutes)</Label>
          <Input
            type="number"
            value={durationMinutes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDurationMinutes(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Room ID</Label>
          <Input
            value={roomId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomId(e.target.value)}
            placeholder="Unique room identifier"
          />
        </div>
        <div className="space-y-2">
          <Label>Default Password (optional)</Label>
          <Input
            type="password"
            value={defaultPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultPassword(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Questions</h3>
            <Button size="sm" variant="outline" onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-1" />
              Add Question
            </Button>
          </div>

          {questions.map((q, idx) => (
            <QuestionForm
              key={idx}
              index={idx}
              question={q}
              onChange={(updated) => {
                const newQuestions = [...questions];
                newQuestions[idx] = updated;
                setQuestions(newQuestions);
              }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            Save Test
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionForm({
  index,
  question,
  onChange,
}: {
  index: number;
  question: QuestionForm;
  onChange: (q: QuestionForm) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Question #{index + 1}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Question Text</Label>
          <Input
            value={question.text}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...question, text: e.target.value })
              }
            placeholder="Enter question text..."
          />
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <select
            value={question.type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                onChange({
                  ...question,
                  type: e.target.value as QuestionType,
                })
              }
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="mcq">Multiple Choice</option>
            <option value="coding">Coding</option>
          </select>
        </div>

        {question.type === "mcq" && (
          <div className="space-y-2">
            <Label>Options</Label>
            {question.options.map((opt) => (
              <div key={opt.key} className="flex items-center gap-2">
                <span className="w-8">{opt.key.toUpperCase()})</span>
                <Input
                  value={opt.text}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({
                      ...question,
                      options: question.options.map((o) =>
                        o.key === opt.key ? { ...o, text: e.target.value } : o
                      ),
                    })
                  }
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Correct Option</Label>
              <select
                value={question.correctOption || ""}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange({
                    ...question,
                    correctOption: (e.target.value as OptionKey) || undefined,
                  })
                }
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="">Select correct option</option>
                {question.options.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.key.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {question.type === "coding" && (
          <div className="space-y-2">
            <Label>Language</Label>
            <Input
              value={question.language || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...question, language: e.target.value })
              }
              placeholder="e.g. javascript"
            />
            <Label>Starter Code</Label>
            <Textarea
              value={question.starterCode || ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                onChange({ ...question, starterCode: e.target.value })
              }
              placeholder="Enter starter code..."
            />
            <Label>Time Limit (ms)</Label>
            <Input
              type="number"
              value={question.timeLimitMs || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...question, timeLimitMs: parseInt(e.target.value, 10) || undefined })
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
