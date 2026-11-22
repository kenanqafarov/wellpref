import type { Metadata } from "next";
import "./globals.css";
import { AgentationWrapper } from "@/components/AgentationWrapper";

export const metadata: Metadata = {
  title: "WellPerf Enterprise | Autonomous Well Surveillance, VFM, PTA & 3D Twin",
  description:
    "Intelligent Well Performance Analysis Platform: Physics-Constrained Virtual Flow Metering (VFM), Automated Pressure Transient Analysis (PTA), 3D Subsurface Twin & Claude AI Engineering Workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[rgb(var(--wp-canvas))] text-zinc-100 antialiased selection:bg-[#155EEF] selection:text-white">
        {children}
        <AgentationWrapper />
      </body>
    </html>
  );
}
