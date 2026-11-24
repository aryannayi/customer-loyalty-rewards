import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customer Loyalty Rewards System",
  description: "Factory Box Code Loyalty & Rewards Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
