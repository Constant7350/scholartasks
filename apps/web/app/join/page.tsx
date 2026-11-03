"use client";

import { useEffect, useState, type FormEvent } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";

export default function Join() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb?.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [sb]);

  if (!sb) return <Page title="Join your family"><NotConfigured /></Page>;
  if (signedIn === false)
    return (
      <Page title="Join your family">
        <div className="panel">
          <h2>Sign in first</h2>
          <p className="hint">Use your own email address, not your parent's.</p>
          <a className="btn btn-inline" style={{ display: "inline-block", textDecoration: "none" }} href="/signin?next=/join">Sign in as a student</a>
        </div>
      </Page>
    );

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await sb.rpc("accept_student_invite", { p_code: code });
    setBusy(false);
    setStatus(error ? { ok: false, text: friendly(error) } : { ok: true, text: "You're connected! Your plan is ready." });
  };

  return (
    <Page title="Join your family">
      <p className="note note-info" style={{ marginTop: 0 }}>
        <strong>Are you the parent?</strong> You don't need a code. Go to <a href="/family">Your family</a> to set things up and get a code for your student.
      </p>
      <form className="panel" onSubmit={join}>
        <p className="eyebrow">For students</p>
        <h2>Enter your family code</h2>
        <p className="hint">Your parent gets this 8-character code by clicking "Invite to the student app" on their family page.</p>
        <div className="field">
          <label htmlFor="code">Family code</label>
          <input
            id="code"
            className="input code-input"
            value={code}
            maxLength={10}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD2345"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
          />
        </div>
        <button className="btn" type="submit" disabled={code.trim().length < 8 || busy}>{busy ? "Joining…" : "Join my family"}</button>
        {status && <p className={`note ${status.ok ? "note-ok" : "note-err"}`} role="status">{status.text}</p>}
      </form>
    </Page>
  );
}
