"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { IUser, ITest } from "@nextgen/shared-types";

export default function UsersPage() {
  return (
    <AuthGuard>
      <AdminLayout>
        <UsersContent />
      </AdminLayout>
    </AuthGuard>
  );
}

function UsersContent() {
  const [users, setUsers] = useState<IUser[]>([]);
  const [tests, setTests] = useState<ITest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/tests")
      .then((res) => setTests(res.data?.tests ?? res.data))
      .catch(() => setTests([]));
  }, []);

  useEffect(() => {
    if (!selectedTestId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get(`/admin/tests/${selectedTestId}/users`)
      .then((res) => {
        const raw = res.data?.users ?? res.data;
        const mapped = (Array.isArray(raw) ? raw : []).map((u: any): IUser => ({
          _id: u._id?.toString?.() ?? u.userId?.toString() ?? u.id ?? "",
          name: u.name ?? "",
          email: u.email ?? "",
          role: "user",
          roomId: u.roomId ?? undefined,
          mustChangePassword: u.mustChangePassword ?? false,
        }));
        setUsers(mapped);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [selectedTestId]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Users</h2>

      <div className="space-y-2">
        <Label>Select a Test</Label>
        <select
          value={selectedTestId}
          onChange={(e) => setSelectedTestId(e.target.value)}
          className="w-full md:w-64 rounded-md border px-3 py-2"
        >
          <option value="">Choose a test...</option>
          {tests.map((t) => (
            <option key={t._id} value={t._id}>
              {t.title} — {t.status}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="text-sm">{user.role}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
