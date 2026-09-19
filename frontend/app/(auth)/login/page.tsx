"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  Zap,
  ChevronLeft,
  UserCheck,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server responded with status ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#fbf9f6] text-[#161616] py-8 px-6 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between">
        <Link
          href="/"
          className="serene-btn-secondary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center gap-2">
          <div className="serene-circle w-8 h-8">
            <Zap className="w-4 h-4 text-[#15803d] fill-[#15803d]" />
          </div>
          <span className="font-editorial text-sm font-normal text-[#161616]">NextGen</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="text-center mb-6">
          <h1 className="font-editorial text-3xl font-normal text-[#161616] tracking-tight">Student Login</h1>
          <p className="text-xs text-[#6b6966] mt-1.5 font-normal">
            Sign in with your email or roll number to begin your assessment
          </p>
        </div>

        <div className="serene-card p-8 sm:p-9">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#ffdad6]/60 border border-[#ba1a1a]/30 flex items-start gap-2.5 text-[#93000a] text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#ba1a1a]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#6b6966] mb-1.5">
                Email Address or Roll No.
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6b6966] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@testportal.com"
                  className="serene-input w-full pl-10 pr-3 py-2.5 text-sm text-[#161616] placeholder:text-[#6b6966]/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b6966] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6b6966] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="serene-input w-full pl-10 pr-3 py-2.5 text-sm text-[#161616] placeholder:text-[#6b6966]/60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="serene-btn-primary w-full py-3.5 px-4 font-semibold text-sm flex items-center justify-center gap-2 mt-3 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 text-[#fbf9f6]" />
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-5 border-t border-[#e6e1d8]">
            <div className="text-[11px] font-semibold text-[#6b6966] mb-2.5 text-center">
              Demo Credentials
            </div>
            <button
              type="button"
              onClick={() => fillCredentials("student@testportal.com", "User@123456")}
              className="serene-card-sm w-full px-3.5 py-2.5 text-xs text-left flex items-center justify-between text-[#161616] hover:border-[#15803d]/40 transition"
            >
              <span className="flex items-center gap-2 font-medium">
                <UserCheck className="w-3.5 h-3.5 text-[#15803d]" />
                <span>Demo Student</span>
              </span>
              <span className="text-[11px] text-[#6b6966] font-mono">
                student@testportal.com
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-[#6b6966]">
        NextGen Test Portal • Serene Humanism Edition
      </div>
    </div>
  );
}
