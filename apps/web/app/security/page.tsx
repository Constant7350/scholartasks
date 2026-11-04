"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { addPasskey, hasBuiltInUnlock, passkeysSupported, unlockName } from "../../lib/passkeys-client";
import { NotConfigured, Page } from "../ui";

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
      await load();
    })();
  }, [sb, load]);

  if (!sb) return <Page title="Face ID and sign-in"><NotConfigured /></Page>;
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

  return (
    <Page title="Face ID and sign-in">
      <div className="panel">
        <h2>Sign in with {unlock}</h2>
        <p className="hint">
          Turn this on once on each phone or computer you use. After that, tap <strong>Sign in with {unlock}</strong> on the sign-in page: no email links and no password.
          Your face or fingerprint stays on your device; ScholarTasks never sees it.
        </p>
        {!supported ? (
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
    </Page>
  );
}
