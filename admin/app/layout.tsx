import type { ReactNode } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "NextGen Test Portal - Admin",
  description: "Admin dashboard for the NextGen online coding test portal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full light" style={{ colorScheme: "light" }}>
      <body
        className={cn(
          inter.className,
          "h-full bg-[#fbf9f6] text-[#161616] antialiased"
        )}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
