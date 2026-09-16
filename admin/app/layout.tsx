import type { ReactNode } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "NextGen Test Portal - Admin",
  description: "Admin dashboard for the NextGen online coding test portal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body
        className={cn(
          inter.className,
          "h-full bg-background text-foreground antialiased"
        )}
      >
        {children}
      </body>
    </html>
  );
}
