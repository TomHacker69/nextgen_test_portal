"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Settings, Shield, Server, Bell, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { session } = useAuth();

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="space-y-8 max-w-4xl mx-auto">
          <div>
            <h2 className="font-editorial text-2xl font-bold text-black tracking-tight">
              Supervisor Settings
            </h2>
            <p className="text-xs text-[#6b6966] mt-1">
              Cluster parameters, proctoring alerts, and account configuration.
            </p>
          </div>

          <div className="space-y-5">
            {/* Account Settings */}
            <div className="serene-card p-6 border border-[#e6e1d8] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#e6e1d8] pb-3">
                <Shield className="w-4 h-4 text-[#15803d]" />
                <h3 className="font-editorial text-base font-bold text-black">
                  Supervisor Account
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="serene-inset p-3.5 space-y-1">
                  <span className="text-[#6b6966] font-semibold text-[11px] block uppercase">
                    Admin Email
                  </span>
                  <span className="font-mono font-bold text-black text-xs">
                    {session?.email || "admin@nextgen.local"}
                  </span>
                </div>
                <div className="serene-inset p-3.5 space-y-1">
                  <span className="text-[#6b6966] font-semibold text-[11px] block uppercase">
                    Role Tier
                  </span>
                  <span className="font-bold text-[#15803d] text-xs uppercase">
                    Root Administrator
                  </span>
                </div>
              </div>
            </div>

            {/* Cluster Engine Settings */}
            <div className="serene-card p-6 border border-[#e6e1d8] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#e6e1d8] pb-3">
                <Server className="w-4 h-4 text-blue-700" />
                <h3 className="font-editorial text-base font-bold text-black">
                  Engine & Compiler Sandbox
                </h3>
              </div>
              <div className="space-y-2 text-xs text-[#6b6966]">
                <div className="flex items-center justify-between p-3 serene-card-sm border border-[#e6e1d8]">
                  <span>Execution Runner Timeout</span>
                  <span className="font-bold font-mono text-black">2000 ms</span>
                </div>
                <div className="flex items-center justify-between p-3 serene-card-sm border border-[#e6e1d8]">
                  <span>Supported Compilers</span>
                  <span className="font-bold text-black">Node.js, Python 3.12, GCC 13, Java 21</span>
                </div>
                <div className="flex items-center justify-between p-3 serene-card-sm border border-[#e6e1d8]">
                  <span>Redis Event Pub/Sub</span>
                  <span className="font-bold text-[#15803d]">Connected (Port 6379)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
