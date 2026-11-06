import type { CSSProperties, ReactNode } from "react";
import { BottomChrome, TopChrome } from "./chrome";

export const card: CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, margin: "16px 0", border: "1px solid #e3e7ee" };

export function Page({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <>
      <TopChrome />
      <main className="page">
        {title && <h1>{title}</h1>}
        {children}
      </main>
      <BottomChrome />
    </>
  );
}

export function NotConfigured() {
  return <p style={card}>Sign-in is not connected yet. Add the Supabase keys from <code>.env.example</code> to turn it on.</p>;
}
