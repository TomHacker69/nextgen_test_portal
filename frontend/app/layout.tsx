import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextGen Test Portal",
  description: "Secure, minimal online examination portal crafted with Serene Humanism & tactile neomorphism.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-[#fbf9f6] text-[#161616] flex flex-col selection:bg-[#15803d] selection:text-white">
        {children}
      </body>
    </html>
  );
}
