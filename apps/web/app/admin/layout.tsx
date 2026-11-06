import type { ReactNode } from "react";
import { AdminShell } from "./shell";

export const metadata = { title: "ScholarTasks team admin", robots: { index: false, follow: false } };

/** Every /admin page gets the team layout: menu on the left, page on the right. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
