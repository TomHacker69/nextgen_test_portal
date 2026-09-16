import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { IUser } from "@nextgen/shared-types";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/tests/0/users")
      .then((res) => setUsers(res.data as IUser[]))
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Users</h2>

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
