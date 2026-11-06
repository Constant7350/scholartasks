"use client";

import { Footer } from "./legal";
import { TopBar } from "./topbar";
import { useInAdminShell } from "./admin/shell";

/** The family top bar and footer. Left out inside the team admin layout, which has its own menu. */
export function TopChrome() {
  return useInAdminShell() ? null : <TopBar />;
}

export function BottomChrome() {
  return useInAdminShell() ? null : <Footer />;
}
