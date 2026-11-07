import type { ReactNode } from "react";
import { PortalShell } from "./portal";

export const metadata = { title: "ScholarTasks school portal" };

/** Every /school page gets the counselor workspace: menu on the left, page on the right. */
export default function SchoolLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
