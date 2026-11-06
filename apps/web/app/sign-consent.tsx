"use client";

import { useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { supabase } from "../lib/supabase";
import { hasBuiltInUnlock, unlockName } from "../lib/passkeys-client";

/**
 * Signed consent, used everywhere a parent (or a school) gives consent:
 * read the wording, type your full name, sign with a finger or mouse, then
 * prove it's you right now with Face ID / fingerprint or a code sent to your email.
 * The server saves the signature (with the exact wording) and the database only
 * lets the consent through for that same person, once. Then `onSigned` runs the action.
 */
export type ConsentKind = "job_application" | "school_link" | "school_agreement" | "video" | "challenge";

export function SignConsent({ kind, wording, version, student, target, title = "Parent consent", button = "Sign and agree", onSigned, onDecline, declineLabel = "Decline" }: {
  kind: ConsentKind; wording: string; version?: string; student?: string; target?: string; title?: string; button?: string;
  onSigned: () => unknown; onDecline?: () => void; declineLabel?: string;
}) {
  const [name, setName] = useState("");
  const [signed, setSigned] = useState<string | null>(null);
  const [step, setStep] = useState<"sign" | "verify">("sign");
  const [faceId, setFaceId] = useState(false);
  const [codeSent, setCodeSent] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void hasBuiltInUnlock().then(setFaceId); }, []);

  const call = async (path: string, body: object) => {
    const sb = supabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
    return j;
  };
  const payload = () => ({ kind, wording, version, student, target, name: name.trim(), signature: signed });

  const finish = async (proof: object) => {
    await call("/api/consent/sign", { ...payload(), ...proof });
    await onSigned();
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    setBusy(false);
  };

  const next = () => {
    setError(null);
    if (name.trim().length < 3 || !/\s/.test(name.trim())) return setError("Type your full name (first and last).");
    if (!signed) return setError("Sign in the box with your finger or mouse.");
    setStep("verify");
  };
  const withFaceId = () => run(async () => {
    const o = await call("/api/passkeys/login-options", {});
    let response;
    try { response = await startAuthentication({ optionsJSON: o.options }); } catch { throw new Error(`${unlockName()} didn't finish. Try again, or use an email code.`); }
    await finish({ method: "passkey", passkey: { challengeId: o.challengeId, response } });
  });
  const sendCode = () => run(async () => { const j = await call("/api/consent/code", {}); setCodeSent(j.sentTo ?? "your email"); });
  const withCode = () => run(async () => {
    if (!/^\d{6}$/.test(code.trim())) throw new Error("Type the 6-digit code from the email.");
    await finish({ method: "email_code", code: code.trim() });
  });

  return (
    <div className="note note-info sign-consent" style={{ display: "grid", gap: 10 }}>
      <b>{title}</b>
      <span style={{ whiteSpace: "pre-wrap" }}>{wording}</span>
      {step === "sign" ? (
        <>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor={`sc-name-${kind}`}>Your full name</label>
            <input id={`sc-name-${kind}`} className="input" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <SignaturePad onChange={setSigned} />
          <span className="opening-actions">
            <button type="button" className="btn btn-inline btn-sm" onClick={next} disabled={busy}>Next: confirm it&apos;s you</button>
            {onDecline && <button type="button" className="btn btn-inline btn-sm btn-ghost" onClick={onDecline} disabled={busy}>{declineLabel}</button>}
          </span>
        </>
      ) : (
        <>
          <span>Last step: confirm it&apos;s really you, so nobody else can sign in your name.</span>
          {faceId && <button type="button" className="btn btn-inline btn-sm" onClick={() => void withFaceId()} disabled={busy}>{busy ? "One moment…" : `${button} with ${unlockName()}`}</button>}
          {!codeSent ? (
            <button className={`btn btn-inline btn-sm ${faceId ? "btn-ghost" : ""}`} onClick={() => void sendCode()} disabled={busy}>Email me a code</button>
          ) : (
            <div className="share-row" style={{ alignItems: "center" }}>
              <label className="hint" htmlFor={`sc-code-${kind}`}>Code sent to {codeSent}</label>
              <input id={`sc-code-${kind}`} className="input input-sm" inputMode="numeric" autoComplete="one-time-code" maxLength={6} style={{ width: 110 }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button type="button" className="btn btn-inline btn-sm" onClick={() => void withCode()} disabled={busy}>{busy ? "One moment…" : button}</button>
              <button type="button" className="btn-link" onClick={() => void sendCode()} disabled={busy}>Send a new code</button>
            </div>
          )}
          <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={() => setStep("sign")} disabled={busy}>← Back</button>
        </>
      )}
      {error && <span className="note note-err" role="alert" style={{ margin: 0 }}>{error}</span>}
      <span className="hint small">Your signature, your name, the wording and the time are saved to a permanent record, and we email you a copy.</span>
    </div>
  );
}

/** A box to sign in with a finger, stylus or mouse. Gives a PNG picture, or null when empty. */
export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const ink = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * scale);
    c.height = Math.round(r.height * scale);
    const g = c.getContext("2d")!;
    g.scale(scale, scale);
    g.lineWidth = 2.5; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#14305a";
  }, []);

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => { e.preventDefault(); ref.current!.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e); const g = ref.current!.getContext("2d")!;
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    ink.current += Math.hypot(p.x - last.current.x, p.y - last.current.y);
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; last.current = null;
    onChange(ink.current > 40 ? ref.current!.toDataURL("image/png") : null);
  };
  const clear = () => {
    const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    ink.current = 0; onChange(null);
  };

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span className="hint">Sign here with your finger or mouse</span>
      <canvas ref={ref} aria-label="Signature box" role="img"
        style={{ width: "100%", height: 150, background: "#fff", border: "1px dashed #b9b2a6", borderRadius: 10, touchAction: "none", cursor: "crosshair" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={clear}>Clear and sign again</button>
    </div>
  );
}
