"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, ArrowRight, Loader2, AlertCircle, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid credentials or server unavailable");
    } finally {
      setLoading(false);
    }
  }

  function fillAdmin() {
    setEmail("admin@nextgen.local");
    setPassword("Admin@1234");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#fbf9f6] text-[#161616]">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="serene-circle w-14 h-14 mx-auto mb-4 text-[#15803d]">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="font-editorial text-3xl font-bold text-black tracking-tight">
            Supervisor Portal
          </h1>
          <p className="text-xs text-[#6b6966]">
            Secure credentials required to access proctoring & assessment controls.
          </p>
        </div>

        {/* Credentials Pill / Quick Autofill */}
        <div className="serene-card-sm p-4 text-xs space-y-2 border border-[#e6e1d8]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#161616] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <KeyRound className="w-3.5 h-3.5 text-[#15803d]" /> Default Credentials
            </span>
            <button
              type="button"
              onClick={fillAdmin}
              className="text-[11px] font-bold text-[#15803d] hover:underline"
            >
              Auto-fill
            </button>
          </div>
          <div className="text-[#6b6966] font-mono text-[11px] space-y-0.5">
            <div>
              Email: <strong className="text-[#161616]">admin@nextgen.local</strong>
            </div>
            <div>
              Password: <strong className="text-[#161616]">Admin@1234</strong>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="serene-card p-8 space-y-5 border border-[#e6e1d8]">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6b6966]">
                Supervisor Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nextgen.local"
                className="w-full px-4 py-3 bg-[#ece7df] border border-[#dbdad7] rounded-xl text-xs text-[#161616] placeholder-[#858383] focus:outline-none focus:border-black transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6b6966]">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#ece7df] border border-[#dbdad7] rounded-xl text-xs text-[#161616] placeholder-[#858383] focus:outline-none focus:border-black transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="serene-btn-primary w-full py-3.5 px-4 font-semibold text-xs tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#fbf9f6]" />
                  Authenticating...
                </>
              ) : (
                <>
                  Enter Supervisor Chamber
                  <ArrowRight className="w-4 h-4 text-[#fbf9f6]" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
