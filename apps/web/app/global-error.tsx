"use client";
import { useEffect } from "react";

/** Last-resort screen if the whole app fails to load: reload once, then offer a button. */
export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    console.error(error);
    try {
      const last = Number(sessionStorage.getItem("st-auto-reload") ?? 0);
      if (Date.now() - last > 30_000) { sessionStorage.setItem("st-auto-reload", String(Date.now())); window.location.reload(); }
    } catch {}
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FAF7F0", color: "#16305A", textAlign: "center", padding: "64px 16px" }}>
        <h1>Something went wrong</h1>
        <p>Reloading usually fixes it.</p>
        <button onClick={() => window.location.reload()} style={{ font: "inherit", padding: "12px 24px", borderRadius: 12, border: 0, background: "#16305A", color: "#fff" }}>Reload</button>
      </body>
    </html>
  );
}
