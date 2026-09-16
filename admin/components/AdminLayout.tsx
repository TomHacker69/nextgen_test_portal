"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TestTube,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tests", label: "Assessments", icon: TestTube },
  { href: "/users", label: "Candidates", icon: Users },
  { href: "/stats", label: "Live Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f6] text-[#161616]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#f5f2eb]/90 backdrop-blur border-b border-[#e6e1d8] px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="serene-circle w-9 h-9 bg-[#ece7df] text-[#161616]">
            <ShieldCheck className="w-5 h-5 text-[#15803d]" />
          </div>
          <div>
            <h1 className="font-editorial text-lg font-bold text-black tracking-tight leading-none">
              NextGen Supervisor
            </h1>
            <p className="text-[11px] text-[#6b6966] mt-0.5">
              Examination & Proctoring Console
            </p>
          </div>
        </div>

        {session && (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-semibold text-[#161616]">
                {session.name || session.email}
              </span>
              <span className="block text-[10px] text-[#6b6966] uppercase font-bold tracking-wider">
                Administrator
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="serene-circle w-8 h-8 text-[#6b6966] hover:text-red-600 transition"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="flex flex-1">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-[#e6e1d8] bg-[#f5f2eb]/50 p-5 space-y-2 hidden md:block">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#6b6966] px-3 mb-2">
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#ece7df] text-black shadow-inner border border-[#dbdad7]"
                    : "text-[#6b6966] hover:bg-[#ece7df]/60 hover:text-black"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-[#15803d]" : "text-[#6b6966]"}`} />
                {item.label}
              </Link>
            );
          })}
        </aside>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
