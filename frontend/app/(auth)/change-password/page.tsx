"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server responded with status ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(data.redirectUrl || "/");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fbf9f6] text-[#1b1c1a]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#ece7df] text-[#161616] mb-4 border border-[#e4e2df]">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-serif font-black text-black tracking-tight">Set Your Password</h1>
          <p className="text-sm text-[#605e5b] mt-2">
            Please establish your permanent credentials before entering the assessment room.
          </p>
        </div>

        <div className="bg-[#f5f2eb] p-8 rounded-2xl border border-[#eae8e5] shadow-sm">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#15803d]" />
              <span>Password updated! Redirecting to your assessment...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#444748] mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-3 bg-white border border-[#dbdad7] rounded-xl text-[#1b1c1a] placeholder-[#858383] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#444748] mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-4 py-3 bg-white border border-[#dbdad7] rounded-xl text-[#1b1c1a] placeholder-[#858383] focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  Save Password & Proceed
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
