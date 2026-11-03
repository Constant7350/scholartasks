import type { CSSProperties, ReactNode } from "react";

export const card: CSSProperties = { background: "#fff", borderRadius: 12, padding: 16, margin: "16px 0", border: "1px solid #e4e4e0" };

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <p style={{ margin: 0 }}><a href="/">ScholarTasks</a></p>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export function NotConfigured() {
  return <p style={card}>Sign-in is not connected yet. Add the Supabase keys from <code>.env.example</code> to turn it on.</p>;
}
