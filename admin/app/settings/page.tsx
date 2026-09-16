import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <AdminLayout>
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Settings</h2>
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Admin settings and configuration options will be available here.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
