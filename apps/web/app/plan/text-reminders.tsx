"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Sms { phone: string | null; sms_on: boolean; verified_at: string | null; pending_phone: string | null }
const show = (p: string) => `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}`;

/** Opt-in text reminders: enter a cell number, type the code we text, done. */
export function TextReminders({ sb }: { sb: SupabaseClient }) {
  const [sms, setSms] = useState<Sms | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const { data } = await sb.from("sms_settings").select("phone, sms_on, verified_at, pending_phone").maybeSingle();
    setSms((data as Sms | null) ?? null);
  };
  useEffect(() => { void load(); }, [sb]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (body: Record<string, string>) => {
    setBusy(true); setMsg(null);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      setMsg({ ok: res.ok, text: out?.message ?? out?.error ?? "Something went wrong. Please try again." });
      return res.ok;
    } finally { setBusy(false); }
  };

  const on = !!(sms?.sms_on && sms.verified_at && sms.phone);
  return (
    <div style={{ marginTop: 12 }}>
      <b>📱 Text reminders</b>
      {on ? (
        <p className="hint" style={{ margin: "4px 0" }}>
          On for {show(sms!.phone!)}: 7 days before, the day before and the day of each deadline, up to 20 texts a month.{" "}
          <button className="btn btn-ghost btn-inline btn-sm" disabled={busy} onClick={async () => { if (await call({ action: "off" })) await load(); }}>Turn off</button>
        </p>
      ) : waiting ? (
        <form className="row" style={{ alignItems: "end" }} onSubmit={async (e) => { e.preventDefault(); if (await call({ action: "confirm", code })) { setWaiting(false); setCode(""); await load(); } }}>
          <div className="field" style={{ flex: "0 1 180px" }}><label htmlFor="sms-code">Code from the text</label>
            <input id="sms-code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <button className="btn btn-inline btn-sm" disabled={busy || code.replace(/\D/g, "").length !== 6}>Turn on texts</button>
          <button type="button" className="btn btn-ghost btn-inline btn-sm" onClick={() => setWaiting(false)}>Change number</button>
        </form>
      ) : (
        <form className="row" style={{ alignItems: "end" }} onSubmit={async (e) => { e.preventDefault(); if (await call({ action: "start", phone })) setWaiting(true); }}>
          <div className="field" style={{ flex: "0 1 220px" }}><label htmlFor="sms-phone">Cell phone (U.S.)</label>
            <input id="sms-phone" className="input" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="404 555 0123" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <button className="btn btn-ghost btn-inline btn-sm" disabled={busy || phone.replace(/\D/g, "").length < 10}>Text me a code</button>
        </form>
      )}
      {!on && <p className="hint small" style={{ margin: "4px 0 0" }}>Optional, and not needed to use ScholarTasks. By pressing Text me a code, you agree to get automated deadline reminder texts from ScholarTasks at this number: 7 days before, the day before and the day of each deadline, up to 20 a month. Message and data rates may apply. Reply STOP to stop or HELP for help. See our <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>.</p>}
      {msg && <p className={`note ${msg.ok ? "note-info" : "note-err"}`} role="status">{msg.text}</p>}
    </div>
  );
}
