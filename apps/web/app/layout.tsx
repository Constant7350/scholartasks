import type { ReactNode } from "react";
import type { Viewport } from "next";
import "./globals.css";

export const metadata = {
  title: "ScholarTasks",
  description: "AI college planning for students and parents.",
};

export const viewport: Viewport = { themeColor: "#14305a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
