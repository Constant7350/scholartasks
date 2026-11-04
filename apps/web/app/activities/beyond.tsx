"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BRAG_QUESTIONS, REC_ROLES, REC_STATUS,
  type BragSheet, type CheckItem, type Recommender, type ServiceEntry,
} from "./shared";

type Run = (fn: () => PromiseLike<{ error: unknown }>) => Promise<boolean>;
const todayIso = () => new Date().toLocaleDateString("en-CA");
const nice = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** What colleges read besides grades, and the next step for each. */
export function Checkup({ items, grade }: { items: CheckItem[]; grade: number }) {
  const done = items.filter((i) => i.ok).length;
  return (
    <section className="panel" id="checkup">
      <h2>Beyond grades check-up</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Grades and hard classes come first. After that, colleges like UGA and Georgia Tech look at activities, leadership,
        service, jobs, recommendation letters and character. {done} of {items.length} look good for grade {grade}.
      </p>
      <ul className="items checkup-list">
        {items.map((i) => (
          <li key={i.key}>
            <div className="item-main">
              <b>{i.ok ? "✅" : "⬜"} {i.title}</b>
              <span className="hint">{i.detail}{!i.ok && i.link && <> <a href={i.link}>Do it →</a></>}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A running log of volunteer shifts. */
export function ServiceLog({ sb, studentId, rows, run }: { sb: SupabaseClient; studentId: string; rows: ServiceEntry[]; run: Run }) {
  const blank = { served_on: todayIso(), hours: "", organization: "", note: "" };
  const [d, setD] = useState(blank);
  const [all, setAll] = useState(false);
  const total = rows.reduce((n, r) => n + Number(r.hours), 0);
  const year = (() => {
    const t = todayIso();
    const [y, m] = t.split("-").map(Number) as [number, number];
    const start = `${m >= 8 ? y : y - 1}-08-01`;
    return rows.filter((r) => r.served_on >= start).reduce((n, r) => n + Number(r.hours), 0);
  })();
  const orgs = [...new Set(rows.map((r) => r.organization))];
  const shown = all ? rows : rows.slice(0, 8);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => sb.from("service_hours").insert({
      student_id: studentId, served_on: d.served_on, hours: Number(d.hours), organization: d.organization.trim(), note: d.note.trim() || null,
    }));
    if (ok) setD({ ...blank, organization: d.organization });
  };

  return (
    <section className="panel" id="service">
      <h2>Service hours log</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Add each volunteer shift as you go. Colleges value steady service with one cause, and many scholarships ask for your total.
        Add the cause as an activity too, so it goes on your Common App and resume.
      </p>
      <div className="todo-summary">
        <span className="todo-count"><b>{year.toLocaleString()}</b> hours this school year</span>
        <span className="todo-count"><b>{total.toLocaleString()}</b> hours in all</span>
      </div>
      <form className="row" onSubmit={add} style={{ alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "0 1 160px" }}><label htmlFor="s-date">Date</label>
          <input id="s-date" type="date" className="input" required max={todayIso()} value={d.served_on} onChange={(e) => setD({ ...d, served_on: e.target.value })} /></div>
        <div className="field" style={{ flex: "0 1 100px" }}><label htmlFor="s-hrs">Hours</label>
          <input id="s-hrs" className="input" inputMode="decimal" required value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value.replace(/[^\d.]/g, "").slice(0, 4) })} /></div>
        <div className="field" style={{ flex: "1 1 220px" }}><label htmlFor="s-org">Where</label>
          <input id="s-org" className="input" required maxLength={100} list="s-orgs" placeholder="County animal shelter" value={d.organization} onChange={(e) => setD({ ...d, organization: e.target.value })} />
          <datalist id="s-orgs">{orgs.map((o) => <option key={o} value={o} />)}</datalist></div>
        <div className="field" style={{ flex: "1 1 220px" }}><label htmlFor="s-note">What you did (optional)</label>
          <input id="s-note" className="input" maxLength={300} placeholder="Walked dogs, cleaned kennels" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></div>
        <button className="btn btn-inline" disabled={!d.hours || Number(d.hours) <= 0 || Number(d.hours) > 24 || !d.organization.trim()}>Add hours</button>
      </form>
      {rows.length > 0 && (
        <ul className="items">
          {shown.map((r) => (
            <li key={r.id}>
              <div className="item-main"><b>{Number(r.hours)} hr{Number(r.hours) === 1 ? "" : "s"} · {r.organization}</b>
                <span className="hint">{nice(r.served_on)}{r.note ? ` · ${r.note}` : ""}</span></div>
              <div className="item-actions">
                <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${r.hours} hours at ${r.organization}`}
                  onClick={() => void run(() => sb.from("service_hours").delete().eq("id", r.id))}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 8 && <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </section>
  );
}

/** Who writes the letters, and where each one stands. */
export function Recommenders({ sb, studentId, rows, run, grade }: { sb: SupabaseClient; studentId: string; rows: Recommender[]; run: Run; grade: number }) {
  const blank = { name: "", role: "teacher", subject: "" };
  const [d, setD] = useState(blank);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => sb.from("recommenders").insert({ student_id: studentId, name: d.name.trim(), role: d.role, subject: d.subject.trim() || null }));
    if (ok) setD(blank);
  };
  const setStatus = (r: Recommender, status: string) =>
    void run(() => sb.from("recommenders").update({ status, asked_on: status !== "thinking" ? r.asked_on ?? todayIso() : r.asked_on }).eq("id", r.id));

  return (
    <section className="panel" id="recs">
      <h2>Recommendation letters</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        {grade < 11
          ? "Most colleges want letters from junior-year teachers. Start noticing which teachers know you well; you'll ask in spring of 11th grade."
          : "Pick two teachers from core or hard classes who know you well (UGA prefers a teacher who saw you in a challenging class). Ask in person, give them your brag sheet and deadlines at least a month ahead, and thank them after."}
      </p>
      {rows.length > 0 && (
        <ul className="items">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="item-main">
                <b>{r.name}</b>
                <span className="hint">{REC_ROLES[r.role] ?? r.role}{r.subject ? ` · ${r.subject}` : ""}{r.asked_on ? ` · asked ${nice(r.asked_on)}` : ""}</span>
              </div>
              <div className="item-actions">
                <select className="input" aria-label={`Status for ${r.name}`} value={r.status} onChange={(e) => setStatus(r, e.target.value)} style={{ width: "auto" }}>
                  {Object.entries(REC_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn btn-ghost btn-inline btn-sm" aria-label={`Remove ${r.name}`}
                  onClick={() => void run(() => sb.from("recommenders").delete().eq("id", r.id))}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="row" onSubmit={add} style={{ alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "1 1 200px" }}><label htmlFor="r-name">Name</label>
          <input id="r-name" className="input" required maxLength={100} placeholder="Ms. Rivera" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
        <div className="field" style={{ flex: "0 1 200px" }}><label htmlFor="r-role">Who they are</label>
          <select id="r-role" className="input" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })}>
            {Object.entries(REC_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="field" style={{ flex: "1 1 180px" }}><label htmlFor="r-subj">Class or place (optional)</label>
          <input id="r-subj" className="input" maxLength={100} placeholder="AP Biology" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} /></div>
        <button className="btn btn-inline" disabled={!d.name.trim()}>Add</button>
      </form>
    </section>
  );
}

/** The student's own answers, for letter writers and essay ideas. Never written by AI. */
export function Brag({ sb, studentId, sheet, run, firstName }: { sb: SupabaseClient; studentId: string; sheet: BragSheet | null; run: Run; firstName: string }) {
  const [a, setA] = useState<Record<string, string>>(sheet?.answers ?? {});
  const [saved, setSaved] = useState(true);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setA(sheet?.answers ?? {}); setSaved(true); }, [sheet, studentId]);

  const save = async () => {
    const clean = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.slice(0, 2000)]));
    const ok = await run(() => sb.from("brag_sheets").upsert({ student_id: studentId, answers: clean, updated_at: new Date().toISOString() }));
    if (ok) setSaved(true);
  };
  const text = [`Brag sheet: ${firstName}`, ""].concat(
    BRAG_QUESTIONS.filter((q) => q.key !== "stories" && a[q.key]?.trim()).flatMap((q) => [q.q, a[q.key]!.trim(), ""]),
  ).join("\n");
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* no clipboard */ }
  };

  return (
    <section className="panel" id="brag">
      <h2>Brag sheet</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Teachers and counselors write better letters when they know your story. Answer in your own words; a few sentences each is plenty.
        Copy it into an email to each recommender. Your essay ideas stay out of the copy.
      </p>
      {BRAG_QUESTIONS.map((q) => (
        <div className="field" key={q.key}>
          <label htmlFor={`b-${q.key}`}>{q.q}</label>
          <textarea id={`b-${q.key}`} className="input" rows={q.key === "stories" ? 4 : 3} maxLength={2000} placeholder={q.hint}
            value={a[q.key] ?? ""} onChange={(e) => { setA({ ...a, [q.key]: e.target.value }); setSaved(false); }} onBlur={() => { if (!saved) void save(); }} />
        </div>
      ))}
      <div className="row">
        <button className="btn btn-inline" disabled={saved} onClick={() => void save()}>{saved ? "Saved ✓" : "Save"}</button>
        <button className="btn btn-ghost btn-inline" disabled={text.split("\n").length <= 2} onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy for my recommenders"}</button>
      </div>
    </section>
  );
}
