import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ITest, TestStatus } from "@nextgen/shared-types";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <AdminLayout>
        <DashboardContent />
      </AdminLayout>
    </AuthGuard>
  );
}

function DashboardContent() {
  const [tests, setTests] = useState<ITest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/tests")
      .then((res) => {
        setTests(res.data as ITest[]);
      })
      .catch((err) => setError(err?.message || "Failed to load tests"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <p className="text-destructive">{error}</p>;

  const stats = {
    total: tests.length,
    scheduled: tests.filter((t) => t.status === "scheduled").length,
    live: tests.filter((t) => t.status === "live").length,
    ended: tests.filter((t) => t.status === "ended").length,
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Tests Overview</h2>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-blue-600">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{stats.scheduled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-green-600">Live</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.live}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">Ended</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-500">{stats.ended}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tests.map((test) => (
              <div
                key={test._id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{test.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(test.scheduledStartTime).toLocaleString()} ·{" "}
                    {test.durationMinutes} min
                  </p>
                </div>
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
