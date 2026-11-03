import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "ScholarTasks",
  description: "AI college planning for students and parents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
