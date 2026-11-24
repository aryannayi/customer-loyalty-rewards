import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EcoRewards™ | Factory Box Code Loyalty System",
  description: "Authentic Product Verification & Eco-Loyalty Rewards Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
