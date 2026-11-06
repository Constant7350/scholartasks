"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ReadAloud } from "./voice";

/** "Read aloud" and "Report this answer" under an AI answer (Google Play AI-generated content rule). */
export function ReportAi({ feature, text }: { feature: string; text: string }) {
  const sb = supabase();
  const [state, setState] = useState<"idle" | "open" | "sending" | "sent" | "error">("idle");
  const [note, setNote] = useState("");
  if (!sb) return null;

  const send = async () => {
    setState("sending");
    try {
      const { data } = await sb.auth.getSession();
      const res = await fetch("/api/ai-report", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ feature, answer: text.slice(0, 8000), note: note.trim().slice(0, 2000) }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") return <p className="report-ai hint">Thanks. Our team will look at this answer.</p>;
  if (state === "idle")
    return (
      <p className="report-ai">
        <ReadAloud text={text} />
        <button type="button" className="linkish" onClick={() => setState("open")}>Report this answer</button>
      </p>
    );
  return (
    <div className="report-ai">
      <label className="hint" htmlFor={`rep-${feature}`}>What&apos;s wrong with it? (optional)</label>
      <textarea id={`rep-${feature}`} className="input" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wrong, unsafe, rude, or did homework for me…" />
      <div className="share-row">
        <button type="button" className="btn btn-inline" onClick={send} disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send report"}</button>
        <button type="button" className="btn btn-ghost btn-inline" onClick={() => setState("idle")}>Cancel</button>
      </div>
      {state === "error" && <p className="note note-err">Couldn&apos;t send the report. Please try again, or email support@scholartasks.com.</p>}
    </div>
  );
}
