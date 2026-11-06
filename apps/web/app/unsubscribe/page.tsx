"use client";

import { useEffect, useState } from "react";
import { Page } from "../ui";

/** Opt-out page linked from school invite emails. A button press (not just opening the link) stops the emails. */
export default function Unsubscribe() {
  const [link, setLink] = useState<{ e: string; t: string } | null>(null);
  const [state, setState] = useState<"ready" | "busy" | "done" | "error">("ready");
  const [error, setError] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setLink({ e: q.get("e") ?? "", t: q.get("t") ?? "" });
  }, []);

  const stop = async () => {
    if (!link) return;
    setState("busy");
    const res = await fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(link) }).catch(() => null);
    const out = (await res?.json().catch(() => null)) as { error?: string } | null;
    if (res?.ok) setState("done");
    else { setError(out?.error ?? "That didn't work. Please email support@scholartasks.com and we'll stop the emails."); setState("error"); }
  };

  return (
    <Page title="Stop school invite emails">
      <div className="panel">
        {state === "done" ? (
          <p role="status">Done. We won&apos;t send school invite emails to <strong>{link?.e}</strong> again.</p>
        ) : link && link.e && link.t ? (
          <>
            <p>Stop emails inviting <strong>{link.e}</strong> to connect with a school on ScholarTasks?</p>
            <button className="btn" disabled={state === "busy"} onClick={stop}>{state === "busy" ? "Stopping…" : "Stop these emails"}</button>
            {state === "error" && <p className="note note-err" role="alert">{error}</p>}
          </>
        ) : (
          <p>This link is missing a part. Email <a href="mailto:support@scholartasks.com?subject=Stop%20emails">support@scholartasks.com</a> and we&apos;ll stop the emails.</p>
        )}
        <p className="hint small">Account emails such as sign-in links and the deadline reminders you turned on are separate. You can turn reminders off on your plan page.</p>
      </div>
    </Page>
  );
}
