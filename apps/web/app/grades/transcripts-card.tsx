"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly } from "../../lib/supabase";

interface FileRow { id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; label: string | null; created_at: string }

const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX = 10 * 1024 * 1024;
const LABELS = ["Unofficial transcript", "Report card", "Official transcript copy", "Other"];
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "file";

/**
 * A private place for the school's own transcripts and report cards. Files
 * are stored per student, open with a short-lived link, and can be read by
 * the AI import to fill in grades.
 */
export function TranscriptsCard({ sb, studentId, name, canEdit, onRead }: {
  sb: SupabaseClient; studentId: string; name: string; canEdit: boolean;
  /** Hands a stored file to the report card reader. */
  onRead?: (file: File) => void;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [label, setLabel] = useState(LABELS[0]!);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await sb.from("transcript_files").select("id, storage_path, file_name, mime_type, size_bytes, label, created_at")
      .eq("student_id", studentId).order("created_at", { ascending: false });
    // Before the database update runs, the table doesn't exist yet: show nothing.
    setFiles(e ? [] : ((data as FileRow[]) ?? []));
  }, [sb, studentId]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    setError(null);
    if (!TYPES.includes(file.type)) return setError("Please choose a PDF or a photo (JPG, PNG or HEIC).");
    if (file.size > MAX) return setError("That file is over 10 MB. Try a smaller scan or one page at a time.");
    setBusy("upload");
    const path = `${studentId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const up = await sb.storage.from("transcripts").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(null); return setError("Sorry, the upload failed. Please try again."); }
    const { error: e } = await sb.from("transcript_files").insert({
      student_id: studentId, storage_path: path, file_name: file.name.slice(0, 200) || "file", mime_type: file.type, size_bytes: file.size, label,
    });
    if (e) { await sb.storage.from("transcripts").remove([path]); setError(friendly(e)); }
    setBusy(null);
    await load();
  };

  const open = async (f: FileRow) => {
    setError(null);
    const tab = window.open("", "_blank");
    const { data, error: e } = await sb.storage.from("transcripts").createSignedUrl(f.storage_path, 120);
    if (e || !data) { tab?.close(); return setError("Sorry, that file couldn't be opened."); }
    if (tab) tab.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  };

  const read = async (f: FileRow) => {
    if (!onRead) return;
    setError(null); setBusy(f.id);
    const { data, error: e } = await sb.storage.from("transcripts").download(f.storage_path);
    setBusy(null);
    if (e || !data) return setError("Sorry, that file couldn't be loaded.");
    onRead(new File([data], f.file_name, { type: f.mime_type }));
  };

  const remove = async (f: FileRow) => {
    if (!window.confirm(`Delete "${f.file_name}"? This can't be undone.`)) return;
    setError(null); setBusy(f.id);
    const { error: e } = await sb.from("transcript_files").delete().eq("id", f.id);
    if (!e) await sb.storage.from("transcripts").remove([f.storage_path]);
    setBusy(null);
    if (e) setError(friendly(e));
    await load();
  };

  return (
    <section className="panel">
      <h2>School transcripts</h2>
      <p className="hint">Keep copies of {name}&apos;s report cards and transcripts from the school here, so they&apos;re handy for applications. Files are private to your family. Colleges still get the official transcript straight from the school.</p>
      {canEdit && (
        <div className="row" style={{ alignItems: "end" }}>
          <div className="field" style={{ flex: "0 1 240px" }}><label htmlFor="tr-label">What is it?</label>
            <select id="tr-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)}>
              {LABELS.map((l) => <option key={l}>{l}</option>)}
            </select></div>
          <label className="btn btn-ghost btn-inline upload-btn">
            {busy === "upload" ? "Uploading…" : "⬆ Upload PDF or photo"}
            <input type="file" accept="application/pdf,image/*" hidden disabled={!!busy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
          </label>
        </div>
      )}
      {error && <p className="note note-err" role="alert">{error}</p>}
      {files.length === 0 ? (
        <p className="hint" style={{ marginTop: 12 }}>No files yet.{canEdit ? " Ask the school counselor's office for an unofficial transcript, or download one from the school's parent portal." : ""}</p>
      ) : (
        <ul className="items" style={{ marginTop: 12 }}>
          {files.map((f) => (
            <li key={f.id}>
              <div className="item-main">
                <b>{f.file_name}</b>
                <span className="hint">{f.label ?? "File"} · {size(f.size_bytes)} · added {new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              <div className="item-actions">
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void open(f)}>Open</button>
                {canEdit && onRead && f.mime_type !== "image/heic" && (f.mime_type !== "application/pdf" || f.size_bytes <= 3_000_000) && (
                  <button className="btn btn-ghost btn-inline btn-sm" disabled={!!busy} title="Uses 1 of today's 10 AI uses" onClick={() => void read(f)}>
                    {busy === f.id ? "Loading…" : "Read grades"}
                  </button>
                )}
                {canEdit && <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Delete ${f.file_name}`} disabled={!!busy} onClick={() => void remove(f)}>Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
