"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { addPasskey, hasBuiltInUnlock, inPhoneApp, passkeysSupported, unlockName } from "../../lib/passkeys-client";
import { NotConfigured, Page } from "../ui";
import { AdultConsent } from "../adult-consent";

interface Device { id: string; device_name: string; created_at: string; last_used_at: string | null }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "never");

export default function Security() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [supported, setSupported] = useState(false);
  const [builtIn, setBuiltIn] = useState(false);
  const [unlock, setUnlock] = useState("Face ID");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [aiOn, setAiOn] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from("passkeys").select("id, device_name, created_at, last_used_at").order("created_at");
    setDevices((data as Device[]) ?? []);
  }, [sb]);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data } = await sb.auth.getSession();
      setSignedIn(!!data.session);
      if (!data.session) return;
      setSupported(passkeysSupported());
      setBuiltIn(await hasBuiltInUnlock());
      setUnlock(unlockName());
      const { data: st, error: stErr } = await sb.from("user_settings").select("ai_consent_at").eq("user_id", data.session.user.id).maybeSingle();
      if (!stErr) setAiOn(!!(st as { ai_consent_at: string | null } | null)?.ai_consent_at);
      await load();
    })();
  }, [sb, load]);

  if (!sb) return <Page title="Face ID, sign-in and account"><NotConfigured /></Page>;
  if (signedIn === null) return <Page><p className="hint">Loading…</p></Page>;
  if (!signedIn) {
    if (typeof window !== "undefined") window.location.replace("/signin?next=/security");
    return <Page><p className="hint">Taking you to sign in…</p></Page>;
  }

  const add = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (await addPasskey(sb)) {
        try { localStorage.setItem("st-passkey", "1"); } catch {}
        setMsg({ ok: true, text: `${unlock} sign-in is on for this device.` });
        await load();
      }
    } catch (e) {
      setMsg({ ok: false, text: friendly(e) });
    }
    setBusy(false);
  };

  const remove = async (d: Device) => {
    setMsg(null);
    const { error } = await sb.from("passkeys").delete().eq("id", d.id);
    if (error) return setMsg({ ok: false, text: friendly(error) });
    setMsg({ ok: true, text: `Removed ${d.device_name}. It can't sign in with Face ID or fingerprint any more.` });
    await load();
  };

  const setAi = async (on: boolean) => {
    const { error } = await sb.rpc("set_ai_consent", { p_on: on });
    if (!error) setAiOn(on);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDelErr(null);
    try {
      const { data } = await sb.auth.getSession();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ confirm: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
      try { localStorage.removeItem("st-passkey"); } catch {}
      await sb.auth.signOut().catch(() => {});
      window.location.replace("/signin?deleted=1");
    } catch (e) {
      setDelErr(friendly(e));
      setDeleting(false);
    }
  };

  return (
    <Page title="Face ID, sign-in and account">
      <div className="panel">
        <h2>Sign in with {unlock}</h2>
        <p className="hint">
          Turn this on once on each phone or computer you use. After that, tap <strong>Sign in with {unlock}</strong> on the sign-in page: no email links and no password.
          Your face or fingerprint stays on your device; ScholarTasks never sees it.
        </p>
        {inPhoneApp() ? (
          <p className="note">You're in the ScholarTasks phone app, which opens with Face ID or your fingerprint on its own. The setting here is for web browsers.</p>
        ) : !supported ? (
          <p className="note">This browser can't do Face ID or fingerprint sign-in. Try Safari on iPhone, Chrome on Android, or an up-to-date browser on your computer.</p>
        ) : (
          <>
            <button className="btn btn-inline" onClick={add} disabled={busy}>{busy ? "One moment…" : `Turn on ${unlock} on this device`}</button>
            {!builtIn && <p className="hint" style={{ marginTop: 10 }}>This computer may not have Face ID or a fingerprint reader. You can still use your phone to sign in here by scanning a code when asked.</p>}
          </>
        )}
        {msg && <p className={`note ${msg.ok ? "note-ok" : "note-err"}`} role="status">{msg.text}</p>}
      </div>

      <div className="panel">
        <h2>Devices that can sign in this way</h2>
        {devices.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>None yet.</p>
        ) : (
          <ul className="device-list">
            {devices.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.device_name}</strong>
                  <div className="when">Added {when(d.created_at)} · last used {when(d.last_used_at)}</div>
                </div>
                <button className="btn btn-ghost btn-inline" onClick={() => remove(d)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>Lost a phone? Remove it here. Your password, email link and Google sign-in keep working as before.</p>
      </div>

      <AdultConsent sb={sb} mode="manage" />

      {aiOn !== null && (
        <div className="panel" id="ai-help">
          <h2>AI help {aiOn ? <span className="pill pill-ok">On</span> : <span className="pill">Off</span>}</h2>
          <p className="hint">
            AI features (the counselor, tutor, essay coach, grade rescue and course advice) are powered by Claude, made by Anthropic. When you use one,
            ScholarTasks sends your question and the planning details needed to answer it to Anthropic. Anthropic may not use it to train AI models.
          </p>
          <button className="btn btn-ghost btn-inline" onClick={() => setAi(!aiOn)}>{aiOn ? "Turn off AI help" : "Allow AI help"}</button>
        </div>
      )}

      <div className="panel" id="delete-account">
        <h2>Delete my account</h2>
        <p className="hint">
          <strong>Parents:</strong> if you are the only parent on the account, this deletes your whole family's ScholarTasks information: every student's plan,
          grades, colleges, scholarships and to-dos, and the students' sign-ins. If another parent is on the account, only you are removed.
        </p>
        <p className="hint">
          <strong>Students:</strong> this deletes your sign-in. Your parent keeps your family's plan.
        </p>
        <p className="hint">This can't be undone. A paid plan needs to be cancelled first. We keep only the locked security log of who changed what and when.</p>
        {!confirming ? (
          <button className="btn btn-ghost btn-inline" onClick={() => setConfirming(true)}>Delete my account</button>
        ) : (
          <div className="share-row">
            <button className="btn btn-inline" style={{ background: "#b42318" }} onClick={deleteAccount} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete it for good"}
            </button>
            <button className="btn btn-ghost btn-inline" onClick={() => setConfirming(false)} disabled={deleting}>Keep my account</button>
          </div>
        )}
        {delErr && <p className="note note-err" role="alert">{delErr}</p>}
      </div>
    </Page>
  );
}
