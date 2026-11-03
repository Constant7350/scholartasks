import type { CSSProperties, ReactNode } from "react";
import { Brand } from "./brand";

export const card: CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, margin: "16px 0", border: "1px solid #e3e7ee" };

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        <nav>
          <a href="/family">Your family</a>
          <a href="/join">Join</a>
          <a href="/signin">Sign in</a>
        </nav>
      </div>
    </header>
  );
}

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="page">
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}

export function NotConfigured() {
  return <p style={card}>Sign-in is not connected yet. Add the Supabase keys from <code>.env.example</code> to turn it on.</p>;
}
