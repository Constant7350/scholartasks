"use client";

import { useEffect, useRef, useState } from "react";
import type { CourseGrade } from "@scholartasks/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly } from "../../lib/supabase";

interface Found { course: string; grade: CourseGrade["grade"]; original_grade: string; level: CourseGrade["level"]; core: boolean; grade_level: number; term: string; keep: boolean }

const LEVELS: Record<string, string> = { standard: "Standard", honors: "Honors", AP: "AP", IB: "IB", DE: "Dual enrollment" };
const TERMS = ["Fall", "Spring", "Full year", "Summer"];

/** Shrinks a phone photo so it uploads quickly and stays under the size limit. */
async function shrinkImage(file: File): Promise<{ mediaType: string; data: string }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

async function readAsBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ImportCard({ sb, studentId, onSaved, file }: {
  sb: SupabaseClient; studentId: string; onSaved: () => void;
  /** A stored transcript to read, handed over from the transcripts card. */
  file?: File | null;
}) {
  const box = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const read = async (file: File) => {
    setError(null); setDone(null); setFound(null); setNote("");
    if (file.type === "application/pdf" && file.size > 3_000_000) return setError("That PDF is over 3 MB. Try one page at a time, or take a photo instead.");
    setBusy("reading");
    try {
      const payload = file.type === "application/pdf" ? { mediaType: file.type, data: await readAsBase64(file) } : await shrinkImage(file);
      const { data: s } = await sb.auth.getSession();
      const res = await fetch("/api/grades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ studentId, ...payload }),
      });
      const out = (await res.json().catch(() => null)) as { courses?: Omit<Found, "keep">[]; note?: string; error?: string } | null;
      if (!res.ok || !out?.courses) throw new Error(out?.error ?? "Sorry, reading the document failed. Please try again.");
      setFound(out.courses.map((c) => ({ ...c, keep: true })));
      setNote(out.note ?? "");
      if (out.courses.length === 0) setError(out.note || "No grades were found in that file.");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't open that file. Try a JPG, PNG or PDF.");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!file) return;
    box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void read(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const save = async () => {
    if (!found) return;
    const rows = found.filter((f) => f.keep && f.course.trim()).map((f) => ({
      student_id: studentId, course: f.course.trim().slice(0, 120), grade: f.grade, level: f.level, core: f.core, grade_level: f.grade_level, term: f.term,
    }));
    if (rows.length === 0) return;
    setBusy("saving"); setError(null);
    const { error: e } = await sb.from("course_grades").insert(rows);
    setBusy(null);
    if (e) return setError(friendly(e));
    setFound(null); setNote(""); setDone(rows.length);
    onSaved();
  };

  const set = (i: number, patch: Partial<Found>) => setFound((list) => list!.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const keepCount = found?.filter((f) => f.keep).length ?? 0;

  return (
    <section className="panel" ref={box}>
      <h2>Add grades from a report card</h2>
      <p className="hint">Take a photo of a report card or transcript, or choose a PDF. The AI reads the courses and grades, and you check them before anything is saved.</p>
      <label className="btn btn-ghost btn-inline upload-btn">
        {busy === "reading" ? "Reading…" : "📷 Choose photo or PDF"}
        <input type="file" accept="image/*,application/pdf" hidden disabled={!!busy}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read(f); }} />
      </label>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {done !== null && <p className="note note-ok">✓ Saved {done} {done === 1 ? "course" : "courses"}.</p>}

      {found && found.length > 0 && (
        <div className="import-review">
          <p className="hint" style={{ margin: "14px 0 8px" }}>
            Found {found.length} {found.length === 1 ? "course" : "courses"}. Fix anything that's wrong and uncheck any you don't want.{note ? ` ${note}` : ""}
          </p>
          <div className="import-table">
            {found.map((f, i) => (
              <div key={i} className={`import-row ${f.keep ? "" : "import-off"}`}>
                <input type="checkbox" aria-label={`Keep ${f.course}`} checked={f.keep} onChange={(e) => set(i, { keep: e.target.checked })} />
                <input className="input import-course" aria-label="Course" value={f.course} onChange={(e) => set(i, { course: e.target.value })} />
                <select className="input" aria-label="Grade" value={f.grade} onChange={(e) => set(i, { grade: e.target.value as Found["grade"] })}>
                  {["A", "B", "C", "D", "F"].map((l) => <option key={l}>{l}</option>)}
                </select>
                <select className="input" aria-label="Level" value={f.level} onChange={(e) => set(i, { level: e.target.value as Found["level"] })}>
                  {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className="input" aria-label="Year" value={f.grade_level} onChange={(e) => set(i, { grade_level: Number(e.target.value) })}>
                  {[6, 7, 8, 9, 10, 11, 12].map((y) => <option key={y} value={y}>{y}th</option>)}
                </select>
                <select className="input" aria-label="Term" value={f.term} onChange={(e) => set(i, { term: e.target.value })}>
                  {TERMS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <label className="import-core"><input type="checkbox" checked={f.core} onChange={(e) => set(i, { core: e.target.checked })} /> Core</label>
                {f.original_grade && f.original_grade !== f.grade && <span className="hint import-orig">Shown as {f.original_grade}</span>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="btn btn-inline" disabled={!!busy || keepCount === 0} onClick={() => void save()}>{busy === "saving" ? "Saving…" : `Save ${keepCount} ${keepCount === 1 ? "course" : "courses"}`}</button>
            <button className="btn btn-ghost btn-inline" disabled={!!busy} onClick={() => { setFound(null); setNote(""); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
