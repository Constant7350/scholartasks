"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly } from "../../lib/supabase";
import { Icon } from "../icons";
import type { DreamBoard } from "../../lib/stage-brief";

/**
 * Dream board (Constant, 2026-11-07): two or three dreams in the student's own words and someone
 * they admire. Saved in students.match_profile.dreams, so the AI counselor and the Homework Helper
 * can connect advice back to them. Shown on Home in the explore and build stages (grades 6 to 10),
 * and in grades 11 and 12 only once it has something in it.
 */
interface Props {
  sb: SupabaseClient;
  student: { id: string; first_name: string; grade_level: number; match_profile?: Record<string, unknown> | null };
  who: "parent" | "student";
  onSaved?: (profile: Record<string, unknown>) => void;
}

const PROMPTS = ["Marine biologist", "Build houses", "Nurse", "Own a bakery", "Pilot", "Game designer", "Teacher", "Electrician", "Vet", "Firefighter"];

export function DreamBoardCard({ sb, student, who, onSaved }: Props) {
  const saved = (student.match_profile?.dreams as DreamBoard | undefined) ?? null;
  const [wants, setWants] = useState<string[]>(["", "", ""]);
  const [admire, setAdmire] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setWants([0, 1, 2].map((i) => saved?.wants?.[i] ?? ""));
    setAdmire(saved?.admire ?? "");
  }, [student.id, saved?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = !saved || (!saved.wants?.some((w) => w.trim()) && !saved.admire);
  const name = who === "student" ? "you" : student.first_name;
  const save = async () => {
    setBusy(true); setErr(null);
    const dreams: DreamBoard = { wants: wants.map((w) => w.trim()).filter(Boolean).slice(0, 3), admire: admire.trim() || undefined, at: new Date().toLocaleDateString("en-CA") };
    const profile = { ...(student.match_profile ?? {}), dreams };
    const { error } = await sb.rpc("set_match_profile", { p_student: student.id, p_profile: profile });
    setBusy(false);
    if (error) return setErr(friendly(error));
    setEditing(false);
    onSaved?.(profile);
  };
  const ask = saved?.wants?.[0] ? `/counselor?ask=${encodeURIComponent(`${who === "student" ? "I want" : `${student.first_name} wants`} to ${saved.wants[0]}. What should ${who === "student" ? "I" : `${student.first_name}`} do this year to get there?`)}&send=1` : "/counselor";

  if (!editing && !empty) {
    return (
      <section className="panel dream" aria-label="Dream board">
        <div className="dream-head">
          <h2><Icon of="🌟" /> {who === "student" ? "My dreams" : `${student.first_name}'s dreams`}</h2>
          <button type="button" className="btn-link" onClick={() => setEditing(true)}>Change</button>
        </div>
        <ul className="dream-list">
          {saved!.wants.filter(Boolean).map((w) => <li key={w} translate="no">{w}</li>)}
        </ul>
        {saved!.admire && <p className="hint dream-admire">Looks up to: <span translate="no">{saved!.admire}</span></p>}
        <a className="btn btn-inline btn-sm link-btn" href={ask}>Ask the counselor how to get there</a>
      </section>
    );
  }

  return (
    <section className="panel dream" aria-label="Dream board">
      <h2><Icon of="🌟" /> {who === "student" ? "What do you dream of doing?" : `What does ${student.first_name} dream of doing?`}</h2>
      <p className="hint">Jobs, things to build, places to go. It can change any time. The counselor and the Homework Helper use this to show {name} how school connects to it.</p>
      <div className="dream-fields">
        {wants.map((w, i) => (
          <input key={i} value={w} maxLength={60} placeholder={i === 0 ? `For example: ${PROMPTS[(student.first_name.length + i) % PROMPTS.length]}` : i === 1 ? "Another idea (optional)" : "One more (optional)"} aria-label={`Dream ${i + 1}`}
            onChange={(e) => setWants(wants.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        <input value={admire} maxLength={120} placeholder="Someone you look up to (optional)" aria-label="Someone you admire" onChange={(e) => setAdmire(e.target.value)} />
      </div>
      {err && <p className="note note-err" role="alert">{err}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-inline" disabled={busy || !wants.some((w) => w.trim())} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
        {!empty && <button className="btn btn-ghost btn-inline" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </section>
  );
}
