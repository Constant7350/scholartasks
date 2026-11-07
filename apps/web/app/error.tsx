"use client";
import { useEffect } from "react";

/** A page crashed. Usually an old screen left open while a new version went live, so reload once on our own. */
export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    try {
      const last = Number(sessionStorage.getItem("st-auto-reload") ?? 0);
      if (Date.now() - last > 30_000) { sessionStorage.setItem("st-auto-reload", String(Date.now())); window.location.reload(); }
    } catch {}
  }, [error]);
  return (
    <main className="container" style={{ padding: "48px 16px", textAlign: "center" }}>
      <h1>Something went wrong</h1>
      <p className="hint">Reloading usually fixes it. If it keeps happening, tell us at support@scholartasks.com.</p>
      <p style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn btn-inline" onClick={() => window.location.reload()}>Reload</button>
        <button className="btn btn-ghost btn-inline" onClick={() => reset()}>Try again</button>
        <a className="btn btn-ghost btn-inline link-btn" href="/home">Home</a>
      </p>
    </main>
  );
}
