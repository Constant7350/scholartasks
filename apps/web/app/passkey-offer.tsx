"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addPasskey, hasBuiltInUnlock, unlockName } from "../lib/passkeys-client";
import { friendly } from "../lib/supabase";

const DISMISS = "st-passkey-offer-dismissed";

/**
 * On the Home page: offers to turn on Face ID / fingerprint sign-in on this
 * device, once, for people who don't have it here yet.
 */
export function PasskeyOffer({ sb }: { sb: SupabaseClient }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlock, setUnlock] = useState("Face ID");

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem(DISMISS) || localStorage.getItem("st-passkey")) return;
      } catch {}
      if (!(await hasBuiltInUnlock())) return;
      setUnlock(unlockName());
      setShow(true);
    })();
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS, "1"); } catch {}
    setShow(false);
  };
  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await addPasskey(sb)) {
        try { localStorage.setItem("st-passkey", "1"); } catch {}
        setDone(true);
      }
    } catch (e) {
      const m = friendly(e);
      if (/already set up/i.test(m)) {
        try { localStorage.setItem("st-passkey", "1"); } catch {}
        setDone(true);
      } else setError(m);
    }
    setBusy(false);
  };

  return (
    <div className="panel family-card passkey-offer" role="region" aria-label={`Sign in with ${unlock}`}>
      {done ? (
        <div>
          <h2>{unlock} is on</h2>
          <p className="hint" style={{ margin: 0 }}>Next time, tap <strong>Sign in with {unlock}</strong>. No email or password needed on this device.</p>
        </div>
      ) : (
        <>
          <div>
            <h2>Sign in with {unlock} next time?</h2>
            <p className="hint" style={{ margin: 0 }}>Skip the emails and passwords on this device. Your face or fingerprint never leaves your phone; ScholarTasks only gets a yes from it.</p>
            {error && <p className="note note-err" role="alert">{error}</p>}
          </div>
          <div className="passkey-actions">
            <button className="btn btn-inline" onClick={turnOn} disabled={busy}>{busy ? "One moment…" : `Turn on ${unlock}`}</button>
            <button className="text-btn" onClick={dismiss}>Not now</button>
          </div>
        </>
      )}
    </div>
  );
}
