"use client";

import { useEffect, useState, type FormEvent } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";

/** Where the "Forgot password" email lands: the link signs the person in, then they choose a new password. */
export default function ResetPassword() {
  const sb = supabase();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((_e, s) => { if (s) setReady(true); });
    sb.auth.getSession().then(({ data: d }) => { if (d.session) setReady(true); });
    const t = setTimeout(() => setReady((r) => r ?? false), 4000);
    return () => { data.subscription.unsubscribe(); clearTimeout(t); };
  }, [sb]);

  if (!sb) return <Page title="Choose a new password"><NotConfigured /></Page>;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) return;
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(friendly(error));
    else window.location.href = "/home";
  };

  return (
    <Page title="Choose a new password">
      {ready === null && <p className="hint">Checking your link…</p>}
      {ready === false && (
        <div className="panel">
          <h2>This link has expired</h2>
          <p className="hint">Reset links work once and only for a short time. Ask for a new one from the sign-in page.</p>
          <a className="btn btn-inline link-btn" href="/signin">Back to sign in</a>
        </div>
      )}
      {ready && (
        <form className="panel" onSubmit={save} noValidate>
          <div className="field">
            <label htmlFor="pw">New password</label>
            <input id="pw" className="input" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw2">Type it again</label>
            <input id="pw2" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {confirm && password !== confirm && <p className="note note-err">The two passwords don't match yet.</p>}
          <button className="btn" type="submit" disabled={busy || password.length < 8 || password !== confirm}>{busy ? "Saving…" : "Save new password"}</button>
          {error && <p className="note note-err" role="alert">{error}</p>}
        </form>
      )}
    </Page>
  );
}
