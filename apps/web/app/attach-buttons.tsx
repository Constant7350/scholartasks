"use client";

import { useRef, useState } from "react";
import { FILE_ACCEPT, readAttachment, type Attachment } from "../lib/attach";
import { supabase } from "../lib/supabase";

/**
 * Two buttons: "Take a photo" opens the camera on a phone, "Upload a file"
 * takes a photo, PDF or Word file. Used by the Homework Helper and the essay coaches.
 */
export function AttachButtons({ onPick, onError, disabled, pdf = true, small, photoLabel = "Take a photo", fileLabel = "Upload a file" }: {
  onPick: (a: Attachment) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** false where a PDF can't be used. */
  pdf?: boolean;
  small?: boolean;
  photoLabel?: string;
  fileLabel?: string;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const take = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try { onPick(await readAttachment(file, { pdf })); } catch (e) { onError((e as Error).message); } finally { setReading(false); }
  };
  const cls = `btn btn-ghost btn-inline${small ? " btn-sm" : ""}`;
  return (
    <>
      <button type="button" className={cls} disabled={disabled || reading} onClick={() => camRef.current?.click()}>📷 {photoLabel}</button>
      <button type="button" className={cls} disabled={disabled || reading} onClick={() => fileRef.current?.click()}>{reading ? "Reading…" : `📎 ${fileLabel}`}</button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={fileRef} type="file" accept={pdf ? FILE_ACCEPT : FILE_ACCEPT.replace("application/pdf,.pdf,", "")} hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );
}

/** A small preview of what's attached, with a Remove link. */
export function AttachPreview({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  return (
    <span className="attach-preview">
      {a.kind === "image" ? <img src={a.dataUrl} alt="Your photo" className="hw-thumb" /> : <span className="attach-file">{a.kind === "pdf" ? "📄" : "📝"} {a.name}</span>}
      <button type="button" className="linklike" onClick={onRemove}>Remove</button>
    </span>
  );
}

/**
 * "Photo of my draft" and "Upload my draft" for the essay coaches. A Word or
 * text file goes straight into the box; a photo or PDF is typed out word for
 * word (1 AI use), never fixed or improved.
 */
export function DraftImport({ studentId, draft, onText, disabled }: { studentId: string; draft: string; onText: (text: string) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const put = (text: string, note: string) => {
    let next = text;
    if (draft.trim()) {
      const replace = window.confirm("Replace what's in the box with this draft? Choose Cancel to add it at the end instead.");
      next = replace ? text : `${draft.trimEnd()}\n\n${text}`;
    }
    onText(next.slice(0, 20000));
    setMsg({ ok: true, text: note });
  };
  const pick = async (a: Attachment) => {
    setMsg(null);
    if (a.kind === "text") { put(a.text, `Added your draft from ${a.name}. Check that it looks right.`); return; }
    setBusy(true);
    try {
      const sb = supabase();
      const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
      const res = await fetch("/api/read-writing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId, file: a.dataUrl }),
      });
      const out = (await res.json().catch(() => null)) as { text?: string; unclear?: number; error?: string } | null;
      if (!res.ok || !out?.text) throw new Error(out?.error ?? "That photo couldn't be read. Please try again.");
      put(out.text, `Typed out from your ${a.kind === "pdf" ? "file" : "photo"}, word for word.${out.unclear ? ` ${out.unclear} word${out.unclear === 1 ? "" : "s"} couldn't be read and show as [?].` : ""} Read it over and fix anything misread.`);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="attach-draft">
      <div className="share-row">
        <AttachButtons onPick={(a) => void pick(a)} onError={(t) => setMsg({ ok: false, text: t })} disabled={disabled || busy} small photoLabel="Photo of my draft" fileLabel={busy ? "Reading your draft…" : "Upload my draft"} />
      </div>
      <p className="hint" style={{ margin: "4px 0 0" }}>Wrote it on paper or in Word or Google Docs? Add it here. A photo is typed out word for word (1 AI use); nothing is fixed or changed.</p>
      {msg && <p className={`note ${msg.ok ? "note-ok" : "note-err"}`} role="status" style={{ marginTop: 6 }}>{msg.text}</p>}
    </div>
  );
}
