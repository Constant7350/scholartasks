import type { ReactNode } from "react";
import type { Viewport } from "next";
import "./globals.css";
import { InAppLinks } from "./in-app-links";

export const metadata = {
  title: "ScholarTasks",
  description: "AI college planning for students and parents.",
  // Opened from the phone's home screen, run full screen like an app (no browser bars).
  appleWebApp: { capable: true, title: "ScholarTasks", statusBarStyle: "default" as const },
};

export const viewport: Viewport = { themeColor: "#14305a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <InAppLinks />
        {children}
      </body>
    </html>
  );
}
