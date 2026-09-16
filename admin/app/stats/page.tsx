"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useParams } from "next/navigation";
import { IUserTestAccess, ITest } from "@nextgen/shared-types";

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

  useEffect(() => {
    api
      .get("/admin/tests")
       .then((res) => setTests(res.data?.tests ?? res.data))
      .catch((_e: unknown) => {
        console.error(_e);
      });
  }, []);

  async function fetchStats(testId: string) {
    setLoading(true);
    setSelectedTestId(testId);
    try {
      const res = await api.get(`/admin/tests/${testId}/stats`);
      setTestStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Test Statistics</h2>

      <Card>
        <CardHeader>
          <CardTitle>Select a Test</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedTestId}
            onChange={(e) => e.target.value && fetchStats(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">Choose a test...</option>
            {tests.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title} — {t.status}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {loading && <p>Loading statistics...</p>}

      {testStats && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>
              {testStats.test?.title || "Test"} — Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Questions</p>
                  <p className="text-2xl font-bold">
                    {testStats.questions?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Participants</p>
                  <p className="text-2xl font-bold">
                    {testStats.participants?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">
                    {testStats.participants?.filter((p: any) => p.isCompleted)
                      .length || 0}
                  </p>
                </div>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b">Student</th>
                    <th className="text-left p-2 border-b">Progress</th>
                    <th className="text-left p-2 border-b">Blocked</th>
                    <th className="text-left p-2 border-b">Extra Time</th>
                  </tr>
                </thead>
                <tbody>
                  {testStats.participants?.map((p: any) => (
                    <tr key={p.userId}>
                      <td className="p-2 border-b">{p.name || p.userName}</td>
                      <td className="p-2 border-b">
                        {p.currentQuestionIndex}/{p.totalQuestions}
                      </td>
                      <td className="p-2 border-b">
                        {p.blocked ? "Yes" : "No"}
                      </td>
                      <td className="p-2 border-b">+{p.extraMinutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
