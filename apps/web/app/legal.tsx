import type { ReactNode } from "react";
import { Page } from "./ui";

export const SUPPORT_EMAIL = "support@scholartasks.com";
export const LEGAL_UPDATED = "November 3, 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page title={title}>
      <p className="hint">Last updated {LEGAL_UPDATED}</p>
      <article className="panel legal">{children}</article>
    </Page>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} ScholarTasks</span>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/delete-account">Delete account</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </footer>
  );
}
