"use client";

import { useCallback, useEffect, useState } from "react";
import { rankOffers, summarizeOffer, type AidOfferDetail } from "@scholartasks/core";
import { supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { pickStudent, useCurrentStudent } from "../../../lib/current-student";
import { money } from "../../../lib/colleges";

interface Student { id: string; first_name: string; permissions?: Record<string, boolean> }
interface College {
  id: string; student_id: string; name: string; status: string; college_id: number | null;
  aid_offer: number | null; aid_offer_detail: (AidOfferDetail & { notes?: string }) | null;
}
interface CollegeData { id: number; cost_attendance: number | null; price_calc_url: string | null }

const FIELDS: { key: keyof AidOfferDetail; label: string; hint: string }[] = [
  { key: "coa", label: "Cost of attendance", hint: "Tuition, fees, housing, food, books. Often called COA or total cost." },
  { key: "grants", label: "Grants and scholarships", hint: "Free money: college awards, Pell, HOPE or Zell, state grants." },
  { key: "student_loans", label: "Student loans", hint: "Direct Subsidized and Unsubsidized loans." },
  { key: "parent_loans", label: "Parent PLUS or private loans", hint: "Debt for the parent or a private lender. Not aid." },
  { key: "work_study", label: "Work-study", hint: "A campus job paid during the year." },
];
const missingCol = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42703" || /aid_offer_detail/.test(e.message ?? ""));

/** One college's award letter, typed in. Saves to the college list and keeps the cost estimate in step. */
function OfferForm({ c, coaFallback, onSaved }: { c: College; coaFallback: number | null; onSaved: () => Promise<void> }) {
  const sb = supabase()!;
  const d = c.aid_offer_detail ?? {};
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, d[f.key] != null ? String(d[f.key]) : f.key === "grants" && c.aid_offer != null ? String(c.aid_offer) : ""])));
  const [notes, setNotes] = useState(d.notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    const detail: Record<string, number | string | null> = Object.fromEntries(FIELDS.map((f) => [f.key, v[f.key] ? Number(v[f.key]) : null]));
    if (notes.trim()) detail.notes = notes.trim().slice(0, 500);
    const grants = detail.grants as number | null;
    const { error } = await sb.from("student_colleges").update({ aid_offer_detail: detail, aid_offer: grants }).eq("id", c.id);
    if (error) return setMsg("Couldn't save. Check the numbers and try again.");
    setMsg("✓ Saved");
    await onSaved();
  };
  return (
    <form className="panel" style={{ margin: "8px 0" }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="hint" style={{ marginTop: 0 }}>Type each number per year, the way the letter shows it. Leave a box empty if the letter doesn&apos;t list it.{coaFallback ? ` If there's no cost of attendance, we use the federal figure (${money(coaFallback)}).` : ""}</p>
      <div className="row" style={{ alignItems: "end", flexWrap: "wrap" }}>
        {FIELDS.map((f) => (
          <div key={f.key} className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor={`o-${c.id}-${f.key}`}>{f.label}</label>
            <input id={`o-${c.id}-${f.key}`} className="input" inputMode="numeric" placeholder="$ per year" value={v[f.key]}
              onChange={(e) => setV({ ...v, [f.key]: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
            <span className="hint small">{f.hint}</span>
          </div>
        ))}
      </div>
      <div className="field"><label htmlFor={`o-${c.id}-notes`}>Notes (optional)</label>
        <input id={`o-${c.id}-notes`} className="input" maxLength={500} placeholder="Renewable if GPA stays 3.0, appeal deadline May 1..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="row"><button className="btn btn-inline btn-sm">Save offer</button>{msg && <span className="hint">{msg}</span>}</div>
    </form>
  );
}

/** Side-by-side award letters: free money, loans and what the family really pays. */
export default function CompareOffers() {
  const sb = supabase();
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [colleges, setColleges] = useState<College[]>([]);
  const [data, setData] = useState<Map<number, CollegeData>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/plan/offers");
    const [mem, st] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, permissions").order("first_name"),
    ]);
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const own = m.find((r) => r.role === "student")?.student_id;
    setIsParent(m.some((r) => r.role === "parent"));
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (own ?? pickStudent(list, list[0]?.id)));
    const col = await sb.from("student_colleges").select("id, student_id, name, status, college_id, aid_offer, aid_offer_detail").order("name");
    if (missingCol(col.error)) return setState("offline");
    const cols = (col.data as College[]) ?? [];
    setColleges(cols);
    const ids = [...new Set(cols.map((c) => c.college_id).filter((x): x is number => x != null))];
    if (ids.length) {
      const { data: cd } = await sb.from("colleges").select("id, cost_attendance, price_calc_url").in("id", ids);
      setData(new Map(((cd as CollegeData[]) ?? []).map((r) => [r.id, r])));
    }
    setState("ready");
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  const title = "Compare aid offers";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (state === "loading") return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (state === "offline") return <Page title={title}><div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>Comparing offers is switching on. Check back shortly.</p></div></Page>;
  const student = students.find((s) => s.id === current);
  if (!student) return <Page title={title}><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;
  const canEdit = isParent || !!student.permissions?.change_plan_without_approval;

  const mine = colleges.filter((c) => c.student_id === student.id && !["withdrawn", "denied"].includes(c.status));
  const rows = rankOffers(mine.map((c) => {
    const fed = c.college_id ? data.get(c.college_id)?.cost_attendance ?? null : null;
    const detail: AidOfferDetail = c.aid_offer_detail ?? (c.aid_offer != null ? { grants: c.aid_offer } : {});
    return { c, fed, has: !!c.aid_offer_detail || c.aid_offer != null, summary: summarizeOffer(detail, fed) };
  }));
  const withOffers = rows.filter((r) => r.has);
  const best = withOffers.find((r) => r.summary.coa);
  const max = Math.max(1, ...withOffers.map((r) => r.summary.coa));

  return (
    <Page title={isParent ? `${student.first_name}'s aid offers` : "My aid offers"}>
      <p className="hint"><a href="/plan">← College list</a> · <a href="/aid">FAFSA and aid forms</a></p>
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      <p className="hint">When award letters arrive (usually March and April), type each one in. We split free money from loans, so you compare what each college really costs, not the biggest number on the letter.</p>

      {withOffers.length > 0 && (
        <section className="panel">
          <h2>Side by side</h2>
          {best && <p style={{ marginTop: 0 }}><b>{best.c.name}</b> costs the least after free money: <b>{money(best.summary.netPrice)}</b> a year.</p>}
          <div style={{ overflowX: "auto" }}>
            <table className="cost-compare">
              <thead><tr><th>College</th><th className="num">Cost</th><th className="num">Free money</th><th className="num">You pay (net price)</th><th className="num">Loans offered</th><th className="num">Work-study</th><th className="num">Left to cover</th><th className="num">Student loans, 4 years</th></tr></thead>
              <tbody>
                {withOffers.map(({ c, summary: s }) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td className="num">{s.coa ? money(s.coa) : "—"}</td>
                    <td className="num">{money(s.free)}{s.coa ? <span className="hint small"> ({Math.round(s.freeShare * 100)}%)</span> : null}</td>
                    <td className="num"><b>{s.coa ? money(s.netPrice) : "—"}</b></td>
                    <td className="num">{money(s.studentLoans + s.parentLoans)}</td>
                    <td className="num">{money(s.workStudy)}</td>
                    <td className="num">{s.coa ? money(s.stillToCover) : "—"}</td>
                    <td className="num">{money(s.fourYearStudentDebt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="offer-bars" aria-label="Free money and what you pay, per college" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {withOffers.filter((r) => r.summary.coa).map(({ c, summary: s }) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 160px) 1fr", gap: 10, alignItems: "center", fontSize: 13 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                <div style={{ display: "flex", height: 16, width: `${(s.coa / max) * 100}%`, borderRadius: 4, overflow: "hidden", background: "var(--line)" }}>
                  <span title={`Free money ${money(s.free)}`} style={{ width: `${(s.free / s.coa) * 100}%`, background: "var(--ok, #1f7a55)" }} />
                  <span title={`You pay ${money(s.netPrice)}`} style={{ flex: 1, background: "var(--warn, #d99a1e)" }} />
                </div>
              </div>
            ))}
            <p className="hint small" style={{ margin: 0 }}>Green is free money, gold is what the family pays from savings, earnings or loans. Bar length is the full cost.</p>
          </div>
          {[...new Set(withOffers.flatMap((r) => r.summary.warnings))].map((w) => <p key={w} className="note" style={{ margin: "8px 0 0" }}>{w}</p>)}
        </section>
      )}

      <section className="panel">
        <h2>Award letters ({withOffers.length} of {mine.length})</h2>
        {mine.length === 0 ? <p className="hint" style={{ margin: 0 }}>Add colleges on your <a href="/plan">college list</a> first.</p> : (
          <ul className="items">
            {rows.map(({ c, fed, has }) => (
              <li key={c.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="item-main"><b>{c.name}</b><span className="hint">{has ? "Offer typed in" : "No offer yet"}{c.aid_offer_detail?.notes ? ` · ${c.aid_offer_detail.notes}` : ""}</span></div>
                  {canEdit && <button className="btn btn-inline btn-sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Close" : has ? "Edit offer" : "Add offer"}</button>}
                </div>
                {open === c.id && <OfferForm c={c} coaFallback={fed} onSaved={async () => { await load(); }} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Before you decide</h2>
        <ul>
          <li>Ask whether each scholarship renews every year and what GPA keeps it.</li>
          <li>If one college offers less than another you like, you can ask for a review (an appeal). Send the better offer and any change in your family&apos;s money.</li>
          <li>Georgia HOPE and Zell only pay at eligible Georgia colleges. They don&apos;t follow you out of state.</li>
          <li>Most colleges want your decision and deposit by May 1.</li>
        </ul>
      </section>
    </Page>
  );
}
