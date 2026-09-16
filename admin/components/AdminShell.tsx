import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 bg-card border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">NextGen Admin Dashboard</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
